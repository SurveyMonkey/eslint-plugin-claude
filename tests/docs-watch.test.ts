// The docs watch fetches the pages that docs/rule-sources.json cites and
// compares them with a stored snapshot. These tests inject the fetch function,
// so no test reaches the network.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts/docs-watch.mjs')
const FIXTURE = readFileSync(
  path.join(import.meta.dirname, 'fixtures/docs-watch/manifest-reference.md'),
  'utf8',
)
const URL_ = 'https://code.claude.com/docs/en/plugins/manifest-reference'

type Block = { id: string; key: string; level: number; title: string; text: string; hash: string }
type Source = { heading: string; id: string; hash: string; text: string }
type Snapshot = {
  url: string
  hash: string
  blocks: { id: string; hash: string }[]
  sources: Source[]
}
type Page = {
  url: string
  status: string
  blocks: { changed: string[]; added: string[]; removed: string[]; unchanged: string[] }
  sources: { heading: string; id: string; status: string }[]
}
type Report = { changed: number; unchanged: number; pages: Page[]; errors: string[] }
type SourceMap = Record<string, { url: string; heading: string; hash?: string }[]>
type Api = {
  sha256: (text: string) => string
  slugify: (heading: string) => string
  splitBlocks: (markdown: string) => Block[]
  snapshotName: (url: string) => string
  checkPages: (input: {
    map: SourceMap
    snapshots: Map<string, Snapshot>
    fetchText: (url: string) => Promise<string>
  }) => Promise<Report>
  readPage: (
    url: string,
    headings: string[],
    fetchText: (url: string) => Promise<string>,
  ) => Promise<Snapshot>
  updateState: (input: {
    root: string
    fetchText: (url: string) => Promise<string>
  }) => Promise<{ pages: number }>
  renderMarkdown: (report: Report) => string
  main: (
    argv: string[],
    env: Record<string, string>,
    fetchText: (url: string) => Promise<string>,
    out: { write: (text: string) => void },
  ) => Promise<number>
}

const api = (await import(SCRIPT)) as Api

const map = (...headings: string[]): SourceMap => ({
  'a-rule': headings.map((heading) => ({ url: URL_, heading })),
})
const serve = (text: string) => async () => text
const snapshotOf = async (text: string, headings: string[]) =>
  new Map([[api.snapshotName(URL_), await api.readPage(URL_, headings, serve(text))]])

describe('slugify', () => {
  it('strips inline code before it slugs the heading', () => {
    expect(api.slugify('`hooks`')).toBe('hooks')
    expect(api.slugify('`commands` and `hooks`')).toBe('commands-and-hooks')
  })

  it('lowercases, drops punctuation and turns spaces into hyphens', () => {
    expect(api.slugify('How each key combines with its default location')).toBe(
      'how-each-key-combines-with-its-default-location',
    )
    expect(api.slugify('Hook loads, but never fires?')).toBe('hook-loads-but-never-fires')
    expect(api.slugify('How entry fields combine with plugin.json')).toBe(
      'how-entry-fields-combine-with-plugin-json',
    )
    expect(api.slugify('Config for <server>: <error>')).toBe('config-for-server-error')
    expect(api.slugify('See [the hooks](/docs/en/hooks) page')).toBe('see-the-hooks-page')
  })
})

describe('splitBlocks', () => {
  const blocks = api.splitBlocks(FIXTURE)

  it('starts a block at each heading, and skips the text before the first', () => {
    expect(blocks.map((block) => block.key)).toEqual([
      'plugin-manifest-reference',
      'component-path-forms',
      'commands',
      'hooks',
      'unrecognized-fields',
      'path-rules',
      'unrecognized-fields-1',
    ])
  })

  it('does not start a block at a heading inside a code fence', () => {
    const commands = blocks.find((block) => block.id === 'commands')
    expect(commands?.text).toContain('## Not a heading, because it is in a code fence')
    expect(blocks.some((block) => block.id === 'not-a-heading-because-it-is-in-a-code-fence')).toBe(
      false,
    )
  })

  it('ends a block at the next heading of any level', () => {
    const forms = blocks.find((block) => block.id === 'component-path-forms')
    expect(forms?.text).toContain('"agents"')
    expect(forms?.text).not.toContain('takes a path')
  })

  it('gives the same hash for the same text, and another for a changed text', () => {
    expect(api.splitBlocks(FIXTURE).map((b) => b.hash)).toEqual(blocks.map((b) => b.hash))
    expect(api.splitBlocks(FIXTURE.replaceAll('\n', '\r\n')).map((b) => b.hash)).toEqual(
      api.splitBlocks(FIXTURE).map((b) => b.hash),
    )
    const edited = api.splitBlocks(FIXTURE.replace('an array mixing both', 'an array'))
    expect(edited.find((b) => b.id === 'hooks')?.hash).not.toBe(
      blocks.find((b) => b.id === 'hooks')?.hash,
    )
    // sha256 of the empty string, from RFC 6234 test vectors.
    expect(api.sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('readPage', () => {
  it('finds the block of an inline-code heading by its slug', async () => {
    const page = await api.readPage(URL_, ['hooks'], serve(FIXTURE))
    expect(page.sources[0]?.id).toBe('hooks')
    expect(page.sources[0]?.text).toContain('`hooks` takes a `.json` file path')
  })

  it('takes the whole page as the source for the page title', async () => {
    const page = await api.readPage(URL_, ['Plugin manifest reference'], serve(FIXTURE))
    expect(page.sources[0]?.hash).toBe(page.hash)
    expect(page.sources[0]?.text).toBe(FIXTURE)
  })

  it('fails and names the page, the heading and the reason for a missing heading', async () => {
    await expect(api.readPage(URL_, ['Nothing here'], serve(FIXTURE))).rejects.toThrow(
      `${URL_}: heading "Nothing here" (id nothing-here) is not on the page`,
    )
  })

  it('fails for a heading that appears twice', async () => {
    await expect(api.readPage(URL_, ['Unrecognized fields'], serve(FIXTURE))).rejects.toThrow(
      `${URL_}: heading "Unrecognized fields" (id unrecognized-fields) appears 2 times`,
    )
  })

  it('fails for a page with no title heading', async () => {
    await expect(api.readPage(URL_, [], serve('Only text.\n'))).rejects.toThrow(
      `${URL_}: the page has no title heading`,
    )
    await expect(api.readPage(URL_, [], serve('## Second level\n'))).rejects.toThrow(
      'no title heading',
    )
  })
})

describe('checkPages', () => {
  const headings = ['hooks', 'Path rules']

  it('reports no change for an unchanged page', async () => {
    const snapshots = await snapshotOf(FIXTURE, headings)
    const report = await api.checkPages({
      map: map(...headings),
      snapshots,
      fetchText: serve(FIXTURE),
    })
    expect(report.errors).toEqual([])
    expect(report.changed).toBe(0)
    expect(report.pages[0]?.status).toBe('unchanged')
    expect(report.pages[0]?.blocks.changed).toEqual([])
    expect(report.pages[0]?.sources.map((source) => source.status)).toEqual([
      'unchanged',
      'unchanged',
    ])
  })

  it('lists a changed block as changed and its neighbors as unchanged', async () => {
    const snapshots = await snapshotOf(FIXTURE, headings)
    const edited = FIXTURE.replace('an array mixing both', 'an array of both')
    const report = await api.checkPages({
      map: map(...headings),
      snapshots,
      fetchText: serve(edited),
    })
    const [page] = report.pages
    expect(report.changed).toBe(1)
    expect(page?.status).toBe('changed')
    expect(page?.blocks.changed).toEqual(['hooks'])
    expect(page?.blocks.added).toEqual([])
    expect(page?.blocks.removed).toEqual([])
    expect(page?.blocks.unchanged).toEqual([
      'plugin-manifest-reference',
      'component-path-forms',
      'commands',
      'unrecognized-fields',
      'path-rules',
      'unrecognized-fields-1',
    ])
    expect(page?.sources).toEqual([
      { heading: 'hooks', id: 'hooks', status: 'changed' },
      { heading: 'Path rules', id: 'path-rules', status: 'unchanged' },
    ])
  })

  it('lists an added heading and a removed heading', async () => {
    const snapshots = await snapshotOf(FIXTURE, headings)
    const edited = FIXTURE.replace('### `commands`', '### `agents`')
    const report = await api.checkPages({
      map: map(...headings),
      snapshots,
      fetchText: serve(edited),
    })
    expect(report.pages[0]?.blocks.added).toEqual(['agents'])
    expect(report.pages[0]?.blocks.removed).toEqual(['commands'])
    expect(report.pages[0]?.blocks.changed).toEqual([])
  })

  it('reports every page as new when the snapshot is missing', async () => {
    const report = await api.checkPages({
      map: map(...headings),
      snapshots: new Map(),
      fetchText: serve(FIXTURE),
    })
    expect(report.errors).toEqual([])
    expect(report.changed).toBe(1)
    expect(report.pages[0]?.status).toBe('new')
    expect(report.pages[0]?.blocks.added).toHaveLength(7)
    expect(report.pages[0]?.sources.map((source) => source.status)).toEqual(['new', 'new'])
  })

  it('reports a mapped heading that the page lost, and does not stop at it', async () => {
    const two: SourceMap = {
      'a-rule': [
        { url: URL_, heading: 'hooks' },
        { url: `${URL_}-two`, heading: 'Gone' },
      ],
    }
    const report = await api.checkPages({
      map: two,
      snapshots: new Map(),
      fetchText: serve(FIXTURE.replace('### `hooks`', '### `mcp`')),
    })
    expect(report.errors).toHaveLength(2)
    expect(report.errors[0]).toContain('heading "hooks" (id hooks) is not on the page')
    expect(report.pages).toEqual([])
  })

  it('reports a duplicate mapped heading', async () => {
    const report = await api.checkPages({
      map: map('Unrecognized fields'),
      snapshots: new Map(),
      fetchText: serve(FIXTURE),
    })
    expect(report.errors).toEqual([expect.stringContaining('appears 2 times')])
  })

  it('reports a failed fetch as an error', async () => {
    const report = await api.checkPages({
      map: map('hooks'),
      snapshots: new Map(),
      fetchText: async (url) => {
        throw new Error(`${url}: HTTP 503`)
      },
    })
    expect(report.errors).toEqual([`${URL_}.md: HTTP 503`])
  })

  it('reports a value that is not an Error as an error', async () => {
    const report = await api.checkPages({
      map: map('hooks'),
      snapshots: new Map(),
      fetchText: () => Promise.reject('down'),
    })
    expect(report.errors).toEqual(['down'])
  })
})

describe('renderMarkdown', () => {
  it('lists the blocks of a changed page and only counts an unchanged page', async () => {
    const snapshots = await snapshotOf(FIXTURE, ['hooks'])
    const edited = FIXTURE.replace('an array mixing both', 'an array of both')
    const changed = api.renderMarkdown(
      await api.checkPages({ map: map('hooks'), snapshots, fetchText: serve(edited) }),
    )
    expect(changed).toContain(`## ${URL_}: changed`)
    expect(changed).toContain('- Changed blocks: `hooks`')
    expect(changed).toContain('- Added blocks: none')
    expect(changed).toContain('- Unchanged blocks: 6')
    const same = api.renderMarkdown(
      await api.checkPages({ map: map('hooks'), snapshots, fetchText: serve(FIXTURE) }),
    )
    expect(same).toContain(`## ${URL_}: unchanged`)
    expect(same).not.toContain('Changed blocks')
  })

  it('lists each error', () => {
    const text = api.renderMarkdown({ changed: 0, unchanged: 0, pages: [], errors: ['bad page'] })
    expect(text).toContain('- ERROR: bad page')
  })
})

describe('snapshotName', () => {
  it('names a snapshot file for a page URL', () => {
    expect(api.snapshotName('https://code.claude.com/docs/en/skills')).toBe('skills.json')
    expect(api.snapshotName(URL_)).toBe('plugins__manifest-reference.json')
  })
})

describe('update and check on a temporary tree', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const tree = (sources: SourceMap) => {
    const root = mkdtempSync(path.join(tmpdir(), 'docs-watch-'))
    dirs.push(root)
    mkdirSync(path.join(root, 'docs'), { recursive: true })
    writeFileSync(path.join(root, 'docs/rule-sources.json'), `${JSON.stringify(sources)}\n`)
    return root
  }
  const run = async (argv: string[], text: string, env: Record<string, string> = {}) => {
    const chunks: string[] = []
    const code = await api.main(argv, env, serve(text), { write: (chunk) => chunks.push(chunk) })
    const out = chunks.join('')
    return { code, out }
  }

  it('writes the snapshot and the map hashes, and check then reports no change', async () => {
    const root = tree(map('hooks'))
    const updated = await run(['update', root], FIXTURE)
    expect(updated.code).toBe(0)
    const snapshotDir = path.join(root, 'docs/docs-snapshot')
    expect(readdirSync(snapshotDir)).toEqual(['plugins__manifest-reference.json'])
    const snapshot = JSON.parse(
      readFileSync(path.join(snapshotDir, 'plugins__manifest-reference.json'), 'utf8'),
    ) as Snapshot
    const written = JSON.parse(
      readFileSync(path.join(root, 'docs/rule-sources.json'), 'utf8'),
    ) as SourceMap
    expect(written['a-rule']?.[0]?.hash).toBe(snapshot.sources[0]?.hash)
    const checked = await run([root], FIXTURE)
    expect(checked.code).toBe(0)
    expect(JSON.parse(checked.out).changed).toBe(0)
  })

  it('check writes no file and exits 0 for a change', async () => {
    const root = tree(map('hooks'))
    await run(['update', root], FIXTURE)
    const before = readFileSync(path.join(root, 'docs/rule-sources.json'), 'utf8')
    const summary = path.join(root, 'summary.md')
    const checked = await run(['check', root], FIXTURE.replace('mixing both', 'mixing'), {
      GITHUB_STEP_SUMMARY: summary,
    })
    expect(checked.code).toBe(0)
    expect(JSON.parse(checked.out).pages[0].blocks.changed).toEqual(['hooks'])
    expect(readFileSync(summary, 'utf8')).toContain('- Changed blocks: `hooks`')
    expect(readFileSync(path.join(root, 'docs/rule-sources.json'), 'utf8')).toBe(before)
    expect(readdirSync(path.join(root, 'docs'))).toEqual(['docs-snapshot', 'rule-sources.json'])
  })

  it('check with no snapshot reports the page as new and exits 0', async () => {
    const root = tree(map('hooks'))
    const checked = await run([root], FIXTURE)
    expect(checked.code).toBe(0)
    expect(JSON.parse(checked.out).pages[0].status).toBe('new')
  })

  it('check exits 1 for a mapped heading that is missing', async () => {
    const root = tree(map('Nothing here'))
    const checked = await run(['check', root], FIXTURE)
    expect(checked.code).toBe(1)
    expect(JSON.parse(checked.out).errors[0]).toContain('is not on the page')
  })

  it('update writes nothing when a heading is missing, and drops a stale snapshot', async () => {
    const root = tree(map('hooks'))
    await run(['update', root], FIXTURE)
    const stale = path.join(root, 'docs/docs-snapshot/old-page.json')
    writeFileSync(stale, '{}\n')
    writeFileSync(path.join(root, 'docs/docs-snapshot/notes.txt'), 'keep\n')
    await run(['update', root], FIXTURE)
    expect(readdirSync(path.join(root, 'docs/docs-snapshot')).sort()).toEqual([
      'notes.txt',
      'plugins__manifest-reference.json',
    ])
    const missing = tree(map('Nothing here'))
    await expect(run(['update', missing], FIXTURE)).rejects.toThrow('is not on the page')
    expect(readdirSync(path.join(missing, 'docs'))).toEqual(['rule-sources.json'])
  })

  it('runs as a command and exits 1 when the map is missing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'docs-watch-'))
    dirs.push(root)
    expect(() => execFileSync('node', [SCRIPT, 'check', root], { stdio: 'pipe' })).toThrow(/ENOENT/)
  })
})

describe('docs/docs-snapshot', () => {
  const sources = JSON.parse(
    readFileSync(path.join(ROOT, 'docs/rule-sources.json'), 'utf8'),
  ) as SourceMap
  const dir = path.join(ROOT, 'docs/docs-snapshot')

  it('has one file for each page that the map cites', () => {
    const pages = new Set(Object.values(sources).flatMap((list) => list.map((s) => s.url)))
    const files = readdirSync(dir).filter((file) => file.endsWith('.json'))
    expect(files.sort()).toEqual([...pages].map((url) => api.snapshotName(url)).sort())
  })

  it('holds the hash of each mapped block', () => {
    for (const list of Object.values(sources)) {
      for (const source of list) {
        const snapshot = JSON.parse(
          readFileSync(path.join(dir, api.snapshotName(source.url)), 'utf8'),
        ) as Snapshot
        const stored = snapshot.sources.find((entry) => entry.heading === source.heading)
        expect(stored, `${source.url} ${source.heading}`).toBeDefined()
        expect(stored?.hash).toBe(api.sha256(stored?.text ?? ''))
      }
    }
  })
})
