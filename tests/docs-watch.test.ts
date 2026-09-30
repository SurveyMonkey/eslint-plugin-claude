// The docs watch fetches the pages that docs/rule-sources.json cites and
// compares them with a stored snapshot. These tests inject the fetch function,
// so no test reaches the network.
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Snapshot, SourceMap } from '../scripts/docs-watch.ts'
import * as api from '../scripts/docs-watch.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts/docs-watch.ts')
const FIXTURE = readFileSync(
  path.join(import.meta.dirname, 'fixtures/docs-watch/manifest-reference.md'),
  'utf8',
)
const URL_ = 'https://code.claude.com/docs/en/plugins/manifest-reference'

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
    // The well-known SHA-256 of the empty string.
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

describe('pagesOf', () => {
  it('lists each page once, with each heading once, across rules', () => {
    const other = 'https://code.claude.com/docs/en/hooks'
    const pages = api.pagesOf({
      a: [
        { url: URL_, heading: 'H' },
        { url: URL_, heading: 'I' },
      ],
      b: [
        { url: URL_, heading: 'H' },
        { url: other, heading: 'J' },
      ],
    })
    expect([...pages]).toEqual([
      [URL_, ['H', 'I']],
      [other, ['J']],
    ])
  })
})

describe('line ends and blank lines', () => {
  it('gives the same page hash and source hash for CRLF text', async () => {
    const lf = await api.readPage(URL_, ['Plugin manifest reference'], serve(FIXTURE))
    const crlf = await api.readPage(
      URL_,
      ['Plugin manifest reference'],
      serve(FIXTURE.replaceAll('\n', '\r\n')),
    )
    expect(crlf.hash).toBe(lf.hash)
    expect(crlf.sources[0]?.hash).toBe(lf.sources[0]?.hash)
  })

  it('ignores blank lines at the end of a block', async () => {
    const spaced = FIXTURE.replace('### `hooks`', '\n\n### `hooks`')
    const report = await api.checkPages({
      map: map('commands'),
      snapshots: await snapshotOf(FIXTURE, ['commands']),
      fetchText: serve(spaced),
    })
    expect(report.pages[0]?.sources[0]?.status).toBe('unchanged')
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

  it('reports an error when the map cites no page', async () => {
    const report = await api.checkPages({ map: {}, snapshots: new Map(), fetchText: serve('') })
    expect(report.errors).toEqual(['the map cites no page'])
  })

  it('counts changed and unchanged pages', async () => {
    const other = 'https://code.claude.com/docs/en/plugins/components'
    const both: SourceMap = {
      a: [
        { url: URL_, heading: 'hooks' },
        { url: other, heading: 'hooks' },
      ],
    }
    const snapshots = new Map([
      [api.snapshotName(URL_), await api.readPage(URL_, ['hooks'], serve(FIXTURE))],
      [api.snapshotName(other), await api.readPage(other, ['hooks'], serve(FIXTURE))],
    ])
    const report = await api.checkPages({
      map: both,
      snapshots,
      fetchText: async (url) =>
        url.includes('components') ? FIXTURE.replace('both', 'two') : FIXTURE,
    })
    expect([report.changed, report.unchanged]).toEqual([1, 1])
  })

  it('reports a page as changed when a mapped heading is not in the snapshot', async () => {
    const snapshots = await snapshotOf(FIXTURE, ['hooks'])
    const report = await api.checkPages({
      map: map('hooks', 'Path rules'),
      snapshots,
      fetchText: serve(FIXTURE),
    })
    expect(report.pages[0]?.status).toBe('changed')
    expect(report.pages[0]?.sources.map((source) => source.status)).toEqual(['unchanged', 'new'])
    expect(report.changed).toBe(1)
  })
})

describe('fetchMarkdown', () => {
  it('names the URL when the network call fails', async () => {
    await expect(api.fetchMarkdown('http://127.0.0.1:1/page.md')).rejects.toThrow(
      /^http:\/\/127\.0\.0\.1:1\/page\.md: /,
    )
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

  it('update writes the hash of each heading, and nothing when a later page fails', async () => {
    const other = 'https://code.claude.com/docs/en/plugins/components'
    const both: SourceMap = {
      a: [
        { url: URL_, heading: 'hooks' },
        { url: URL_, heading: 'Path rules' },
      ],
      b: [{ url: other, heading: 'hooks' }],
    }
    const root = tree(both)
    await api.main(['update', root], {}, serve(FIXTURE), { write: () => {} })
    const written = JSON.parse(
      readFileSync(path.join(root, 'docs/rule-sources.json'), 'utf8'),
    ) as SourceMap
    const hooks = api.sha256(
      '### `hooks`\n\n`hooks` takes a `.json` file path, an inline hooks object, or an array mixing both.',
    )
    const paths = written.a?.map((source) => source.hash)
    expect(paths?.[0]).toBe(hooks)
    expect(paths?.[1]).toBe(api.splitBlocks(FIXTURE).find((b) => b.id === 'path-rules')?.hash)
    expect(written.b?.[0]?.hash).toBe(hooks)

    const partial = tree(both)
    const failing = async (url: string) => {
      if (url.includes('components')) throw new Error('down')
      return FIXTURE
    }
    await expect(api.main(['update', partial], {}, failing, { write: () => {} })).rejects.toThrow(
      'down',
    )
    expect(readdirSync(path.join(partial, 'docs'))).toEqual(['rule-sources.json'])
  })

  it('update stops for a map that cites no page, and keeps the snapshot', async () => {
    const root = tree(map('hooks'))
    await run(['update', root], FIXTURE)
    writeFileSync(path.join(root, 'docs/rule-sources.json'), '{}\n')
    await expect(run(['update', root], FIXTURE)).rejects.toThrow('the map cites no page')
    expect(readdirSync(path.join(root, 'docs/docs-snapshot'))).toHaveLength(1)
  })

  it('stops for an option that it does not know', async () => {
    const root = tree(map('hooks'))
    await expect(run(['update', '--dry-run', root], FIXTURE)).rejects.toThrow(
      'unknown option --dry-run',
    )
    expect(readdirSync(path.join(root, 'docs'))).toEqual(['rule-sources.json'])
  })

  it('adds the summary to the text that is in the file already', async () => {
    const root = tree(map('hooks'))
    const summary = path.join(root, 'summary.md')
    writeFileSync(summary, 'prior\n')
    await run(['check', root], FIXTURE, { GITHUB_STEP_SUMMARY: summary })
    expect(readFileSync(summary, 'utf8')).toMatch(/^prior\n# Claude Code docs watch/)
  })

  it('names the file for a snapshot that is not JSON', async () => {
    const root = tree(map('hooks'))
    mkdirSync(path.join(root, 'docs/docs-snapshot'))
    const bad = path.join(root, 'docs/docs-snapshot/bad.json')
    writeFileSync(bad, '{')
    expect(() => api.loadSnapshots(root)).toThrow(bad)
  })

  it('treats a missing snapshot directory as empty, and any other fault as a failure', () => {
    const root = tree(map('hooks'))
    expect(api.loadSnapshots(root).size).toBe(0)
    writeFileSync(path.join(root, 'docs/docs-snapshot'), 'a file, not a directory\n')
    expect(() => api.loadSnapshots(root)).toThrow(/ENOTDIR/)
  })

  it('runs through a symbolic link', () => {
    const root = tree({})
    const link = path.join(root, 'watch.ts')
    symlinkSync(SCRIPT, link)
    let output = ''
    try {
      execFileSync(process.execPath, ['--experimental-strip-types', link, 'check', root], {
        stdio: 'pipe',
      })
    } catch (error) {
      const failure = error as { status: number; stdout: Buffer }
      expect(failure.status).toBe(1)
      output = failure.stdout.toString()
    }
    expect(output).toContain('the map cites no page')
  })

  it('runs as a command and exits 1 when the map is missing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'docs-watch-'))
    dirs.push(root)
    expect(() =>
      execFileSync(process.execPath, ['--experimental-strip-types', SCRIPT, 'check', root], {
        stdio: 'pipe',
      }),
    ).toThrow(/ENOENT/)
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
