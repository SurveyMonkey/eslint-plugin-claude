// The snapshot gate runs the docs watch again against the base state of a
// pull request, in dry run. These tests build a real git repository in a
// temporary directory. They inject the docs fetch, the Jev fetch and the gh
// runner, so no test reaches the network or GitHub.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Answers, JevFetch, Request } from '../scripts/docs-classify.ts'
import type { Run } from '../scripts/docs-issues.ts'
import * as api from '../scripts/docs-verify.ts'
import type { FetchText, SourceMap } from '../scripts/docs-watch.ts'
import * as watch from '../scripts/docs-watch.ts'

const FIXTURES = path.join(import.meta.dirname, 'fixtures/docs-watch')
const PAGE = readFileSync(path.join(FIXTURES, 'manifest-reference.md'), 'utf8')
const SKILLS = readFileSync(path.join(FIXTURES, 'skills-html.md'), 'utf8')
const URL_ = 'https://code.claude.com/docs/en/plugins/manifest-reference'
const SKILLS_URL = 'https://code.claude.com/docs/en/skills'
const SNAPSHOT = 'docs/docs-snapshot/plugins__manifest-reference.json'
const REPO = 'SurveyMonkey/eslint-plugin-claude'
const KEY = 'test-key-not-real-0123'

const EDIT_HOOKS = PAGE.replace('an array mixing both', 'an array of both')
const EDIT_COMMANDS = PAGE.replace('or an object map', 'or a map')
const EDIT_BOTH = EDIT_HOOKS.replace('or an object map', 'or a map')
const NO_COMMANDS = PAGE.replace(/### `commands`\n[\s\S]*?(?=### `hooks`)/, '')

const cited: SourceMap = { 'a-rule': [{ url: URL_, heading: 'hooks' }] }

// An inventory row in "Skills and commands" (group issue #50) cites the
// `commands` block. No rule cites it.
const INVENTORY = [
  '## Rules by group',
  '',
  '### Skills and commands',
  '',
  '| Rule | Checks | Docs |',
  '|------|--------|------|',
  '| `command-x` | A check. | [^cmd] |',
  '',
  `[^cmd]: [Plugins reference: commands](${URL_}#commands)`,
  '',
].join('\n')

// The end of the remedy, without its first sentence. The gate prints it when a block has no key match.
const REMEDY =
  'Run the docs watch workflow, triage what it opens, then run `update` again. ' +
  'If the workflow opens no issue for a failed block above, open one by hand. ' +
  'Start its body with the marker line of that block, and leave it open:'

const dirs: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// The pre-commit hook runs these tests with GIT_DIR and GIT_INDEX_FILE set
// to the repository of the hook. Then a git call here writes to that
// repository, not to the temporary one. So the tests remove each GIT_
// variable. The gate and the git calls below get the clean environment.
for (const name of Object.keys(process.env)) {
  if (name.startsWith('GIT_')) delete process.env[name]
}

// git with no user or system config, so a hook or a signature key on this
// machine does not change the result.
const git = (root: string, ...args: string[]) =>
  execFileSync(
    'git',
    [
      '-C',
      root,
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    },
  ).trim()

const serve =
  (text: string): FetchText =>
  async () =>
    text

// Serves each page by its URL. A URL that is not in the list fails.
const servePages =
  (pages: Record<string, string>): FetchText =>
  async (url) => {
    const text = pages[url]
    if (text === undefined) throw new Error(`no page for ${url}`)
    return text
  }

const refresh = (live: FetchText) => (root: string) => watch.updateState({ root, fetchText: live })

// Makes a repository with the docs state of `live` and the map in a base
// commit. `before` edits the base tree before the commit. Then `change` edits
// the tree, and a head commit stores the edit. Returns the root and the SHA of
// the base commit.
async function repoWith(
  change: (root: string) => unknown,
  live: FetchText = serve(PAGE),
  map: SourceMap = cited,
  before: (root: string) => unknown = () => {},
) {
  const root = mkdtempSync(path.join(tmpdir(), 'docs-verify-'))
  dirs.push(root)
  mkdirSync(path.join(root, 'docs/rules'), { recursive: true })
  writeFileSync(
    path.join(root, 'docs/rules/a-rule.md'),
    `---\ntype: Reference\ndescription: The rule a-rule checks hook names.\n---\n\n# a-rule\n\n[^h]: [Plugins reference: hooks](${URL_}#hooks)\n`,
  )
  writeFileSync(path.join(root, 'docs/rules/index.md'), '# Rules\n')
  writeFileSync(path.join(root, 'docs/rules-inventory.md'), INVENTORY)
  writeFileSync(path.join(root, 'docs/rule-sources.json'), `${JSON.stringify(map)}\n`)
  await watch.updateState({ root, fetchText: live })
  await before(root)
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '-m', 'base')
  const base = git(root, 'rev-parse', 'HEAD')
  await change(root)
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '--allow-empty', '-m', 'head')
  return { root, base }
}

// The hash that the head snapshot stores for a block.
const headHash = (root: string, id: string) =>
  (
    JSON.parse(readFileSync(path.join(root, SNAPSHOT), 'utf8')) as {
      blocks: { id: string; hash: string }[]
    }
  ).blocks.find((block) => block.id === id)?.hash

// A fake Jev that answers each question with the value for its id, or 0.
function fakeJev(values: Record<string, number> = {}) {
  const calls: Request[] = []
  const fetch: JevFetch = async (_url, init) => {
    const request = JSON.parse(init.body) as Request
    calls.push(request)
    const answers: Answers = {}
    for (const id of Object.keys(request.questions)) {
      answers[id] = { type: 'noul', noul: values[id.replace(/_\d+$/, '')] ?? 0 }
    }
    return new Response(JSON.stringify({ model: 'jev-1.13.0', answers }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { fetch, calls }
}

// A fake gh that reads only. It serves the open issues, and the state and
// the comments of each group issue. Any other call fails, so a write fails.
function fakeGh({
  issues = [],
  groups = {},
}: {
  issues?: { number: number; body: string }[]
  groups?: Record<number, { state: string; comments: string[] }>
} = {}) {
  const calls: string[][] = []
  const run: Run = (args) => {
    calls.push(args)
    const line = args.join(' ')
    if (line === 'repo view --json nameWithOwner --jq .nameWithOwner') return `${REPO}\n`
    if (line.startsWith(`api --paginate repos/${REPO}/issues?state=open&per_page=100 `)) {
      return issues.map((issue) => JSON.stringify(issue)).join('\n')
    }
    const state = /^api repos\/[^ ]+\/issues\/(\d+) --jq \.state$/.exec(line)
    if (state) return `${groups[Number(state[1])]?.state}\n`
    const comments = /^api --paginate repos\/[^ ]+\/issues\/(\d+)\/comments\?per_page=100 /.exec(
      line,
    )
    if (comments) {
      const list = groups[Number(comments[1])]?.comments ?? []
      return list.map((body) => JSON.stringify({ body })).join('\n')
    }
    throw new Error(`unexpected gh call: ${line}`)
  }
  return { run, calls }
}

// Runs the gate on a root, and returns the exit code and the output.
async function verify(
  root: string,
  base: string,
  deps: Parameters<typeof api.main>[2],
  env: Record<string, string | undefined> = { TYPESAFE_API_KEY: KEY },
  extra: string[] = ['--repo', REPO],
) {
  const chunks: string[] = []
  const code = await api.main([base, root, ...extra], env, {
    ...deps,
    out: { write: (text: string) => chunks.push(text) },
  })
  return { code, text: chunks.join('') }
}

const failFetch: FetchText = async (url) => {
  throw new Error(`no fetch expected: ${url}`)
}

describe('a diff that does not touch the docs watch state', () => {
  it('passes at once, with no fetch, no Jev call and no gh call', async () => {
    const { root, base } = await repoWith((dir) => {
      writeFileSync(path.join(dir, 'README.md'), '# Readme\n')
      // A near miss: the name starts with the snapshot directory name.
      mkdirSync(path.join(dir, 'docs/docs-snapshot-old'))
      writeFileSync(path.join(dir, 'docs/docs-snapshot-old/x.json'), '{}\n')
      writeFileSync(path.join(dir, 'docs/rules/a-rule.md'), '# a-rule, changed\n')
    })
    const jev = fakeJev()
    const gh = fakeGh()
    const { code, text } = await verify(
      root,
      base,
      { fetchText: failFetch, fetch: jev.fetch, run: gh.run },
      {},
      [],
    )
    expect(code).toBe(0)
    expect(text).toBe(
      'docs-snapshot: the diff changes no file in docs/docs-snapshot/ and not docs/rule-sources.json. Pass.\n',
    )
    expect(jev.calls).toEqual([])
    expect(gh.calls).toEqual([])
  })
})

describe('a diff that changes the snapshot', () => {
  it.each([
    ['empty', { TYPESAFE_API_KEY: '' }],
    ['not set', {}],
  ])('fails when TYPESAFE_API_KEY is %s, and names the cause', async (_, env) => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const gh = fakeGh()
    const { code, text } = await verify(root, base, { fetchText: failFetch, run: gh.run }, env)
    expect(code).toBe(1)
    expect(text).toContain('TYPESAFE_API_KEY is not set')
    expect(text).toContain('A pull request from a fork or from Dependabot gets no secret')
    expect(gh.calls).toEqual([])
  })

  it('fails when the dry run would open an issue, and names the block', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const summary = path.join(root, 'summary.md')
    writeFileSync(summary, 'an earlier step\n')
    const gh = fakeGh()
    const { code, text } = await verify(
      root,
      base,
      { fetchText: serve(EDIT_HOOKS), fetch: fakeJev({ alters: 0.84 }).fetch, run: gh.run },
      { TYPESAFE_API_KEY: KEY, GITHUB_STEP_SUMMARY: summary, GITHUB_REPOSITORY: 'other/repo' },
    )
    expect(code).toBe(1)
    // --repo names the repository, so gh and GITHUB_REPOSITORY do not.
    expect(gh.calls.map((args) => args.slice(0, 2))).not.toContainEqual(['repo', 'view'])
    const hash = headHash(root, 'hooks')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(text).toContain(`- rule-update: ${URL_} block hooks, hash ${hash}`)
    expect(text).toContain('The dry run would open 1 issue(s) and post 0 comment(s).')
    expect(text).not.toContain(KEY)
    const marker = `<!-- docs-watch:rule-update:${URL_}#hooks:${hash} -->`
    expect(text).toContain(REMEDY)
    expect(text).toContain(`${marker}\n`)
    expect(text.split(REMEDY)).toHaveLength(2)
    const written = readFileSync(summary, 'utf8')
    expect(written.startsWith('an earlier step\n')).toBe(true)
    expect(written).toContain(`- rule-update: ${URL_} block hooks, hash ${hash}`)
    expect(written).toContain(REMEDY)
    // The summary is Markdown, which hides an HTML comment, so a fence holds the marker.
    expect(written).toContain(`\`\`\`\n${marker}\n\`\`\`\n`)
  })

  it('fails when the dry run would post only a tracked comment', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_COMMANDS)))
    const gh = fakeGh({ groups: { 50: { state: 'open', comments: [] } } })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev().fetch,
      run: gh.run,
    })
    expect(code).toBe(1)
    expect(text).toContain(`- tracked: ${URL_} block commands, hash ${headHash(root, 'commands')}`)
    expect(text).toContain('The dry run would open 0 issue(s) and post 1 comment(s).')
    expect(text).toContain(REMEDY)
    expect(text).toContain(
      `<!-- docs-watch:rule-update:${URL_}#commands:${headHash(root, 'commands')} -->\n`,
    )
  })

  it('passes when the dry run opens nothing and the head snapshot is the live docs', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.05, obsolete: 0.02 }).fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(0)
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).not.toContain('The gate accepts')
    expect(text).toContain('The head snapshot is the live docs.')
    expect(text).toContain('docs-snapshot: pass')
    expect(text).not.toContain(REMEDY)
    expect(text).not.toContain('<!-- docs-watch:')
  })

  it('passes a block that an open issue and a group issue comment already name', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_BOTH)))
    const hooks = headHash(root, 'hooks')
    const commands = headHash(root, 'commands')
    const gh = fakeGh({
      issues: [
        {
          number: 275,
          body: `<!-- docs-watch:rule-update:${URL_}#hooks:${hooks} rules=a-rule -->\n`,
        },
      ],
      groups: {
        50: {
          state: 'open',
          comments: [`<!-- docs-watch-tracked:${URL_}#commands:${commands} -->`],
        },
      },
    })
    // No --repo and no GITHUB_REPOSITORY: gh names the repository.
    const { code, text } = await verify(
      root,
      base,
      { fetchText: serve(EDIT_BOTH), fetch: fakeJev({ alters: 0.84 }).fetch, run: gh.run },
      { TYPESAFE_API_KEY: KEY },
      [],
    )
    expect(code).toBe(0)
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).not.toContain('- rule-update:')
    expect(text).not.toContain('- tracked:')
    expect(gh.calls).toContainEqual([
      'repo',
      'view',
      '--json',
      'nameWithOwner',
      '--jq',
      '.nameWithOwner',
    ])
  })

  it('fails when the head snapshot is not the live docs, and says to run update again', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const gh = fakeGh({ groups: { 50: { state: 'closed', comments: [] } } })
    const { code, text } = await verify(
      root,
      base,
      { fetchText: serve(EDIT_BOTH), fetch: fakeJev().fetch, run: gh.run },
      { TYPESAFE_API_KEY: KEY, GITHUB_REPOSITORY: REPO },
      [],
    )
    expect(code).toBe(1)
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).toContain('1 page(s) of the head snapshot are not the live docs')
    expect(text.split('1 page(s) of the head snapshot are not the live docs')).toHaveLength(2)
    expect(text).toContain('Run `node scripts/docs-watch.ts update` again')
    // GITHUB_REPOSITORY names the repository, so gh does not.
    expect(gh.calls.map((args) => args.slice(0, 2))).not.toContainEqual(['repo', 'view'])
  })

  it('fails when the check of the head gives an error', async () => {
    const { root, base } = await repoWith(async (dir) => {
      await refresh(serve(EDIT_HOOKS))(dir)
      // A map hash that is not the snapshot hash is a check error.
      const map = JSON.parse(readFileSync(path.join(dir, 'docs/rule-sources.json'), 'utf8'))
      map['a-rule'][0].hash = 'f'.repeat(64)
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(map)}\n`)
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(1)
    expect(text).toContain('The check of the head has 1 error(s):')
    expect(text).toContain(`- ${URL_}: the map hash of "hooks" for a-rule is not the snapshot hash`)
    // The docs did not change, so the gate does not say so.
    expect(text).not.toContain('The docs changed after')
  })

  it('fails when the head map cannot be read', async () => {
    const { root, base } = await repoWith((dir) => {
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), '{ not json')
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(PAGE),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(1)
    expect(text).toContain('The check of the head failed:')
    expect(text.split('The check of the head failed:')).toHaveLength(2)
    expect(text).toContain('rule-sources.json')
  })

  it('names the reason of a needs-triage block, such as a failed Jev request', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const jevDown: JevFetch = async () => new Response('', { status: 401 })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: jevDown,
      wait: async () => {},
      run: fakeGh().run,
    })
    expect(code).toBe(1)
    expect(text).toContain(
      `- needs-triage: ${URL_} block hooks, hash ${headHash(root, 'hooks')}: The Jev request failed`,
    )
    expect(text).toContain('401')
    expect(text).toContain(
      `<!-- docs-watch:needs-triage:${URL_}#hooks:${headHash(root, 'hooks')} -->\n`,
    )
  })

  it('fails both steps when the page fetch fails', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const { code, text } = await verify(root, base, {
      fetchText: async () => {
        throw new Error('ECONNRESET')
      },
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(1)
    expect(text).toContain('The dry run failed: ECONNRESET')
    expect(text).toContain('The check of the head has 1 error(s):')
    expect(text).toContain('- ECONNRESET')
  })

  it('does not classify a page that the head map cites and the base map does not', async () => {
    const pages = { [`${URL_}.md`]: PAGE, [`${SKILLS_URL}.md`]: SKILLS }
    const { root, base } = await repoWith(async (dir) => {
      const map: SourceMap = {
        ...cited,
        'b-rule': [{ url: SKILLS_URL, heading: 'Choose where skills load' }],
      }
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(map)}\n`)
      await refresh(servePages(pages))(dir)
    }, serve(PAGE))
    const jev = fakeJev({ requirement: 0.9 })
    const { code, text } = await verify(root, base, {
      fetchText: servePages(pages),
      fetch: jev.fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(0)
    expect(jev.calls).toEqual([])
    expect(text).toContain('The head snapshot is the live docs.')
  })
})

// Rewrites the snapshot file in another format: no body hash, and another indent.
const reformat = (dir: string) => {
  const file = path.join(dir, SNAPSHOT)
  const snapshot = JSON.parse(readFileSync(file, 'utf8')) as watch.Snapshot
  snapshot.blocks = snapshot.blocks.map(({ id, hash }) => ({ id, hash }))
  writeFileSync(file, `${JSON.stringify(snapshot, null, 4)}\n`)
}

// Removes the page text from the snapshot file, as before ADR 002 Decision 9.
const dropText = (dir: string) => {
  const file = path.join(dir, SNAPSHOT)
  const { text: _, ...rest } = JSON.parse(readFileSync(file, 'utf8')) as { text: string }
  writeFileSync(file, `${JSON.stringify(rest, null, 2)}\n`)
}

// A docs fetch that counts its reads, and serves the live docs, which changed.
const counted = () => {
  const reads: string[] = []
  const fetchText: FetchText = async (url) => {
    reads.push(url)
    return EDIT_HOOKS
  }
  return { reads, fetchText }
}

const changed = (root: string, base: string) =>
  git(root, 'diff', '--name-only', base, 'HEAD').split('\n')

// A head whose page hashes and block hashes are the base stores no docs
// change. So the gate compares it with the base, not with the live docs (#419).
describe('a head whose page hashes and block hashes are the base', () => {
  // b-rule cites a second heading of the page. The map hashes come from `update`.
  const twoRules: SourceMap = { ...cited, 'b-rule': [{ url: URL_, heading: 'commands' }] }

  it('passes a new format and a map change after the live docs change, with no key', async () => {
    const { root, base } = await repoWith(async (dir) => {
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(twoRules)}\n`)
      await refresh(serve(PAGE))(dir)
      reformat(dir)
    })
    expect(changed(root, base)).toEqual([SNAPSHOT, 'docs/rule-sources.json'])
    const live = counted()
    const jev = fakeJev()
    const gh = fakeGh()
    const { code, text } = await verify(
      root,
      base,
      { fetchText: live.fetchText, fetch: jev.fetch, run: gh.run },
      {},
    )
    expect(text).toContain(
      'Each page hash and block hash of the head snapshot is the base. ' +
        'The gate compares the head with the base, not with the live docs.',
    )
    expect(text).toContain('The head snapshot is the base snapshot.')
    expect(text).not.toContain('TYPESAFE_API_KEY')
    expect(text).not.toContain('The dry run')
    expect(text).toContain('docs-snapshot: pass')
    expect(code).toBe(0)
    expect(live.reads).toEqual([])
    expect(jev.calls).toEqual([])
    expect(gh.calls).toEqual([])
  })

  it('passes a head that adds the page text to a base with none, as in #388', async () => {
    const { root, base } = await repoWith(refresh(serve(PAGE)), serve(PAGE), cited, dropText)
    expect(changed(root, base)).toEqual([SNAPSHOT])
    const live = counted()
    const { code, text } = await verify(root, base, { fetchText: live.fetchText }, {})
    expect(text).toContain('The head snapshot is the base snapshot.')
    expect(code).toBe(0)
    expect(live.reads).toEqual([])
  })

  it('passes a head that stops a citation of a page, and keeps the other hashes', async () => {
    const pages = { [`${URL_}.md`]: PAGE, [`${SKILLS_URL}.md`]: SKILLS }
    const both: SourceMap = {
      ...cited,
      'b-rule': [{ url: SKILLS_URL, heading: 'Choose where skills load' }],
    }
    const { root, base } = await repoWith(
      async (dir) => {
        writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(cited)}\n`)
        await refresh(servePages(pages))(dir)
      },
      servePages(pages),
      both,
    )
    expect(changed(root, base)).toEqual([
      'docs/docs-snapshot/skills.json',
      'docs/rule-sources.json',
    ])
    const { code, text } = await verify(root, base, { fetchText: failFetch }, {})
    expect(text).toContain('The head snapshot is the base snapshot.')
    expect(code).toBe(0)
  })

  it('fails a map change with no `update`, and says to run update again', async () => {
    const { root, base } = await repoWith((dir) => {
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(twoRules)}\n`)
    })
    const { code, text } = await verify(root, base, { fetchText: failFetch }, {})
    expect(text).toContain(
      '1 page(s) of the head snapshot are not the base snapshot. ' +
        'The map changed and `update` did not run. ' +
        'Run `node scripts/docs-watch.ts update` again, and push.',
    )
    expect(text).not.toContain('The head snapshot is the base snapshot.')
    expect(text).toContain('docs-snapshot: fail')
    expect(code).toBe(1)
  })

  it('fails a head map hash that is not the snapshot hash', async () => {
    const { root, base } = await repoWith(async (dir) => {
      reformat(dir)
      const map = JSON.parse(readFileSync(path.join(dir, 'docs/rule-sources.json'), 'utf8'))
      map['a-rule'][0].hash = 'f'.repeat(64)
      writeFileSync(path.join(dir, 'docs/rule-sources.json'), `${JSON.stringify(map)}\n`)
    })
    const { code, text } = await verify(root, base, { fetchText: failFetch }, {})
    expect(text).toContain('The gate compares the head with the base')
    expect(text).toContain('The check of the head has 1 error(s):')
    expect(text).toContain(`- ${URL_}: the map hash of "hooks" for a-rule is not the snapshot hash`)
    expect(code).toBe(1)
  })
})

// A head that changes a hash, or that the gate cannot compare with the base,
// gets the dry run and the compare with the live docs.
describe('a head that the gate does not compare with the base', () => {
  it('fails a new format with a changed hash that no open issue has', async () => {
    const { root, base } = await repoWith(async (dir) => {
      await refresh(serve(EDIT_HOOKS))(dir)
      const file = path.join(dir, SNAPSHOT)
      writeFileSync(file, `${JSON.stringify(JSON.parse(readFileSync(file, 'utf8')), null, 4)}\n`)
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: fakeGh().run,
    })
    expect(text).not.toContain('The gate compares the head with the base')
    expect(text).toContain(`- rule-update: ${URL_} block hooks, hash ${headHash(root, 'hooks')}`)
    expect(text).toContain('docs-snapshot: fail')
    expect(code).toBe(1)
  })

  it('passes a new format with a changed hash that an open issue has', async () => {
    const { root, base } = await repoWith(async (dir) => {
      await refresh(serve(EDIT_HOOKS))(dir)
      const file = path.join(dir, SNAPSHOT)
      writeFileSync(file, `${JSON.stringify(JSON.parse(readFileSync(file, 'utf8')), null, 4)}\n`)
    })
    const key = `${URL_}#hooks:${headHash(root, 'hooks')}`
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: fakeGh({
        issues: [{ number: 282, body: `<!-- docs-watch:rule-update:${key} rules=a-rule -->\n` }],
      }).run,
    })
    expect(text).not.toContain('The gate compares the head with the base')
    // The issue step skips a block that an open issue has.
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).not.toContain('- rule-update:')
    expect(text).toContain('The head snapshot is the live docs.')
    expect(code).toBe(0)
  })

  it('compares a head with the live docs when only the page hash changed', async () => {
    // The blocks drop the blank lines at the end of the page, so each block hash stays.
    const tail = `${PAGE}\n\n\n`
    const { root, base } = await repoWith(refresh(serve(tail)))
    expect(changed(root, base)).toEqual([SNAPSHOT])
    const { code, text } = await verify(root, base, {
      fetchText: serve(tail),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(text).not.toContain('The gate compares the head with the base')
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).toContain('The head snapshot is the live docs.')
    expect(code).toBe(0)
  })

  it('compares a head with the live docs when no snapshot file has the page text', async () => {
    const { root, base } = await repoWith(
      async (dir) => {
        await refresh(serve(PAGE))(dir)
        reformat(dir)
        dropText(dir)
      },
      serve(PAGE),
      cited,
      dropText,
    )
    expect(changed(root, base)).toEqual([SNAPSHOT])
    const { code, text } = await verify(root, base, { fetchText: failFetch }, {})
    expect(text).not.toContain('The gate compares the head with the base')
    expect(text).toContain('TYPESAFE_API_KEY is not set')
    expect(code).toBe(1)
  })

  it('compares a head with the live docs when a head snapshot file cannot be read', async () => {
    const { root, base } = await repoWith((dir) => {
      writeFileSync(path.join(dir, SNAPSHOT), '{ not json')
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(PAGE),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(text).not.toContain('The gate compares the head with the base')
    expect(text).toContain('The check of the head failed:')
    expect(text).toContain('plugins__manifest-reference.json')
    expect(code).toBe(1)
  })
})

// The gate asks if a person saw the text of a block, so it matches a block
// by its key only (#316). Jev can give a different answer in each run, so
// the rules of a finding can change while its key stays.
describe('a block whose key an open issue or a group issue comment has', () => {
  // b-rule cites the page title, so it names each block of the page. The
  // commands block stays tracked, and its finding names b-rule.
  const whole: SourceMap = {
    ...cited,
    'b-rule': [{ url: URL_, heading: 'Plugin manifest reference' }],
  }

  it('passes a block that an open issue has with other rules, and names its new rules', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const key = `${URL_}#hooks:${headHash(root, 'hooks')}`
    const gh = fakeGh({
      issues: [{ number: 282, body: `<!-- docs-watch:rule-update:${key} rules=other-rule -->\n` }],
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain('The dry run would open 1 issue(s) and post 0 comment(s).')
    expect(text).toContain('The gate accepts these blocks.')
    expect(text).toContain(`- accepted: ${key}, held by #282, new rules: a-rule\n`)
    expect(text).not.toContain('- rule-update:')
    expect(text).toContain('docs-snapshot: pass')
    expect(code).toBe(0)
  })

  it('names only the rules that the open issue does not name', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)), serve(PAGE), whole)
    const key = `${URL_}#hooks:${headHash(root, 'hooks')}`
    const gh = fakeGh({
      issues: [{ number: 282, body: `<!-- docs-watch:rule-update:${key} rules=a-rule -->\n` }],
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain(`- accepted: ${key}, held by #282, new rules: b-rule\n`)
    expect(code).toBe(0)
  })

  it('passes a block that a group issue comment has, and names its new rules', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_COMMANDS)), serve(PAGE), whole)
    const key = `${URL_}#commands:${headHash(root, 'commands')}`
    const gh = fakeGh({
      groups: { 50: { state: 'open', comments: [`<!-- docs-watch-tracked:${key} -->`] } },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain('The dry run would open 1 issue(s) and post 0 comment(s).')
    expect(text).toContain(`- accepted: ${key}, held by #50, new rules: b-rule\n`)
    expect(code).toBe(0)
  })

  it('does not take a tracked comment from a closed group issue', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_COMMANDS)), serve(PAGE), whole)
    const key = `${URL_}#commands:${headHash(root, 'commands')}`
    const gh = fakeGh({
      groups: { 50: { state: 'closed', comments: [`<!-- docs-watch-tracked:${key} -->`] } },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain(
      `- rule-update: ${URL_} block commands, hash ${headHash(root, 'commands')}`,
    )
    expect(text).not.toContain('- accepted:')
    expect(code).toBe(1)
  })

  it('passes a tracked comment block that an open issue has, with no new rules', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_COMMANDS)))
    const key = `${URL_}#commands:${headHash(root, 'commands')}`
    const gh = fakeGh({
      issues: [{ number: 301, body: `<!-- docs-watch:new-rule:${key} -->\n` }],
      groups: { 50: { state: 'open', comments: [] } },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev().fetch,
      run: gh.run,
    })
    expect(text).toContain('The dry run would open 0 issue(s) and post 1 comment(s).')
    expect(text).toContain(`- accepted: ${key}, held by #301\n`)
    expect(text).not.toContain('- tracked:')
    expect(code).toBe(0)
  })

  it('names a block once when the dry run would put it in an issue and a comment', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_COMMANDS)), serve(PAGE), whole)
    const key = `${URL_}#commands:${headHash(root, 'commands')}`
    const gh = fakeGh({
      issues: [{ number: 282, body: `<!-- docs-watch:new-rule:${key} rules=other-rule -->\n` }],
      groups: { 50: { state: 'open', comments: [] } },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain('The dry run would open 1 issue(s) and post 1 comment(s).')
    expect(text.split('- accepted:')).toHaveLength(2)
    expect(text).toContain(`- accepted: ${key}, held by #282, new rules: b-rule\n`)
    expect(code).toBe(0)
  })

  it('fails a block when the open issue has the block with another hash', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const old = `${URL_}#hooks:${'a'.repeat(64)}`
    const gh = fakeGh({
      issues: [{ number: 282, body: `<!-- docs-watch:rule-update:${old} rules=a-rule -->\n` }],
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain(`- rule-update: ${URL_} block hooks, hash ${headHash(root, 'hooks')}`)
    expect(text).not.toContain('- accepted:')
    expect(text).toContain('docs-snapshot: fail')
    expect(code).toBe(1)
  })

  it('fails a mix, and names only the block with no key match', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_BOTH)))
    const hooks = `${URL_}#hooks:${headHash(root, 'hooks')}`
    const gh = fakeGh({
      issues: [
        { number: 282, body: `<!-- docs-watch:rule-update:${hooks} rules=other-rule -->\n` },
      ],
      groups: { 50: { state: 'open', comments: [] } },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_BOTH),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(text).toContain('The dry run would open 1 issue(s) and post 1 comment(s).')
    expect(text).toContain(`- tracked: ${URL_} block commands, hash ${headHash(root, 'commands')}`)
    expect(text).not.toContain('- rule-update:')
    // The held block has no marker. The unmatched tracked block has one.
    expect(text).not.toContain(`<!-- docs-watch:rule-update:${hooks} -->`)
    expect(text).toContain(
      `<!-- docs-watch:rule-update:${URL_}#commands:${headHash(root, 'commands')} -->\n`,
    )
    expect(text).toContain(`- accepted: ${hooks}, held by #282, new rules: a-rule\n`)
    expect(text).toContain('docs-snapshot: fail')
    expect(code).toBe(1)
  })
})

describe('the markers of the remedy', () => {
  it('names the block with no key match, and not a tracked block that a comment holds', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_BOTH)))
    const hooks = headHash(root, 'hooks')
    const commands = headHash(root, 'commands')
    const gh = fakeGh({
      groups: {
        50: {
          state: 'open',
          comments: [`<!-- docs-watch-tracked:${URL_}#commands:${commands} -->`],
        },
      },
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_BOTH),
      fetch: fakeJev({ alters: 0.84 }).fetch,
      run: gh.run,
    })
    expect(code).toBe(1)
    expect(text).toContain(`<!-- docs-watch:rule-update:${URL_}#hooks:${hooks} -->\n`)
    expect(text).not.toContain(`<!-- docs-watch:rule-update:${URL_}#commands:${commands} -->`)
  })
})

describe('the base state and the page reads', () => {
  it('classifies with the base inventory, not the head inventory', async () => {
    // The head removes the inventory row of `commands`. The base still has
    // it, so the block is tracked, and the dry run would post a comment.
    const { root, base } = await repoWith(async (dir) => {
      writeFileSync(path.join(dir, 'docs/rules-inventory.md'), '## Rules by group\n')
      await refresh(serve(EDIT_COMMANDS))(dir)
    })
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_COMMANDS),
      fetch: fakeJev().fetch,
      run: fakeGh({ groups: { 50: { state: 'open', comments: [] } } }).run,
    })
    expect(code).toBe(1)
    expect(text).toContain(`- tracked: ${URL_} block commands, hash ${headHash(root, 'commands')}`)
  })

  it('asks Jev with the base rule docs, not the head rule docs', async () => {
    const { root, base } = await repoWith(async (dir) => {
      const file = path.join(dir, 'docs/rules/a-rule.md')
      const text = readFileSync(file, 'utf8')
      writeFileSync(file, text.replace('checks hook names', 'checks a head change'))
      await refresh(serve(EDIT_HOOKS))(dir)
    })
    const jev = fakeJev()
    const { code } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: jev.fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(0)
    const asked = JSON.stringify(jev.calls)
    expect(asked).toContain('The rule a-rule checks hook names.')
    expect(asked).not.toContain('checks a head change')
  })

  it('names a removed block by its old hash', async () => {
    let old: string | undefined
    const { root, base } = await repoWith(async (dir) => {
      old = headHash(dir, 'commands')
      await refresh(serve(NO_COMMANDS))(dir)
    })
    expect(NO_COMMANDS).not.toContain('### `commands`')
    expect(old).toMatch(/^[0-9a-f]{64}$/)
    const { code, text } = await verify(root, base, {
      fetchText: serve(NO_COMMANDS),
      fetch: fakeJev().fetch,
      run: fakeGh({ groups: { 50: { state: 'open', comments: [] } } }).run,
    })
    expect(code).toBe(1)
    expect(text).toContain(`- tracked: ${URL_} block commands, hash gone:${old}`)
    expect(text).toContain(`<!-- docs-watch:rule-update:${URL_}#commands:gone:${old} -->\n`)
  })

  it('reads each page once, so the head check sees the text that the dry run read', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    // The first read gets the text of the head snapshot. A later read gets
    // newer text.
    const reads: string[] = []
    const fetchText: FetchText = async (url) => {
      reads.push(url)
      return reads.length === 1 ? EDIT_HOOKS : EDIT_BOTH
    }
    const { code, text } = await verify(root, base, {
      fetchText,
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(0)
    expect(reads).toEqual([`${URL_}.md`])
    expect(text).toContain('The head snapshot is the live docs.')
  })

  it('removes its temporary root', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const temp = mkdtempSync(path.join(tmpdir(), 'docs-verify-tmp-'))
    dirs.push(temp)
    vi.stubEnv('TMPDIR', temp)
    expect(tmpdir()).toBe(temp)
    const { code } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(code).toBe(0)
    expect(readdirSync(temp)).toEqual([])
  })
})

describe('the diff of the base and the head', () => {
  it('counts a snapshot file that the pull request moves out of the snapshot', async () => {
    const { root, base } = await repoWith((dir) => {
      renameSync(path.join(dir, SNAPSHOT), path.join(dir, 'docs/old-snapshot.json'))
    })
    // Rename detection on, whatever the config of this machine says.
    const config = path.join(root, 'renames.gitconfig')
    writeFileSync(config, '[diff]\n\trenames = true\n')
    vi.stubEnv('GIT_CONFIG_GLOBAL', config)
    const { code, text } = await verify(root, base, {}, {})
    expect(code).toBe(1)
    expect(text).toContain('TYPESAFE_API_KEY is not set')
  })

  // Each row makes a git call of the gate fail, or read another repository,
  // when the gate keeps the variable. A git hook can set each one.
  it.each<[string, (decoy: string) => Record<string, string>]>([
    ['GIT_DIR', (d) => ({ GIT_DIR: `${d}/.git`, GIT_INDEX_FILE: `${d}/.git/index` })],
    ['GIT_COMMON_DIR', (d) => ({ GIT_COMMON_DIR: `${d}/.git` })],
    ['GIT_OBJECT_DIRECTORY', (d) => ({ GIT_OBJECT_DIRECTORY: `${d}/.git/objects` })],
    ['GIT_CONFIG_PARAMETERS', (d) => ({ GIT_CONFIG_PARAMETERS: `'diff.orderFile'='${d}/none'` })],
    [
      'GIT_CONFIG_COUNT',
      (d) => ({
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'diff.orderFile',
        GIT_CONFIG_VALUE_0: `${d}/none`,
      }),
    ],
    ['GIT_ICASE_PATHSPECS', () => ({ GIT_ICASE_PATHSPECS: '1' })],
    ['GIT_GLOB_PATHSPECS', () => ({ GIT_GLOB_PATHSPECS: '1' })],
  ])('reads the root and the base files with %s set, as under a git hook', async (_, vars) => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const decoy = mkdtempSync(path.join(tmpdir(), 'docs-verify-decoy-'))
    dirs.push(decoy)
    git(decoy, 'init', '-q')
    for (const [name, value] of Object.entries(vars(decoy))) vi.stubEnv(name, value)
    const { code, text } = await verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
    })
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).toContain('docs-snapshot: pass')
    expect(code).toBe(0)
  })
})

describe('the gate fails closed', () => {
  const steps = async (deps: Parameters<typeof api.main>[2]) => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    return verify(root, base, {
      fetchText: serve(EDIT_HOOKS),
      fetch: fakeJev().fetch,
      run: fakeGh().run,
      ...deps,
    })
  }

  it('fails when the classifier throws', async () => {
    const { code, text } = await steps({
      classify: async () => {
        throw new Error('Jev is down')
      },
    })
    expect(code).toBe(1)
    expect(text).toContain('The dry run failed: Jev is down')
    expect(text.split('The dry run failed: Jev is down')).toHaveLength(2)
  })

  it.each([
    ['no list', { model: 'jev-1.13.0' }],
    ['no tracked list', { model: 'jev-1.13.0', findings: [] }],
    ['no findings list', { model: 'jev-1.13.0', tracked: [] }],
  ])('fails when the classifier gives %s', async (_, output) => {
    const { code, text } = await steps({
      classify: async () => output as never,
    })
    expect(code).toBe(1)
    expect(text).toContain(
      'The dry run failed: the classifier output has no findings or tracked list',
    )
  })

  it('fails when the issue step throws', async () => {
    const { code, text } = await steps({
      openIssues: async () => {
        throw new Error('gh: HTTP 401')
      },
    })
    expect(code).toBe(1)
    expect(text).toContain('The dry run failed: gh: HTTP 401')
    expect(text.split('The dry run failed: gh: HTTP 401')).toHaveLength(2)
  })

  it.each([
    ['no count', { opened: [], skipped: 0, commented: [] }],
    ['no wouldComment count', { wouldOpen: 0 }],
    ['no wouldOpen count', { wouldComment: 0 }],
  ])('fails when the issue step gives %s', async (_, report) => {
    const { code, text } = await steps({
      openIssues: async () => report as never,
    })
    expect(code).toBe(1)
    expect(text).toContain(
      'The dry run failed: the issue step report has no wouldOpen or wouldComment count',
    )
  })

  // A would-open body with the marker of a block, as the issue step logs it.
  const OPEN_LOG = `would open: a title\n\n<!-- docs-watch:rule-update:${URL_}#hooks:${'a'.repeat(64)} rules=a-rule -->`
  // A would-comment body with the tracked marker of a block.
  const COMMENT_LOG = `would comment on #50:\n\n<!-- docs-watch-tracked:${URL_}#hooks:${'a'.repeat(64)} -->`

  it.each([
    [
      'the open issue read throws',
      () => {
        throw new Error('gh: HTTP 502')
      },
      'gh: HTTP 502',
    ],
    ['the open issue read gives a line that is not JSON', () => 'not json', 'JSON'],
  ])('fails when %s in the key match', async (_, run: Run, message) => {
    const { code, text } = await steps({
      openIssues: async ({ log }) => {
        log(OPEN_LOG)
        return { opened: [], skipped: 0, wouldOpen: 1, commented: [], wouldComment: 0 }
      },
      run,
    })
    expect(code).toBe(1)
    expect(text).toContain('The dry run failed:')
    expect(text).toContain(message)
  })

  it('fails a logged block with no key match that the findings do not name', async () => {
    const { code, text } = await steps({
      openIssues: async ({ log }) => {
        log(OPEN_LOG)
        return { opened: [], skipped: 0, wouldOpen: 1, commented: [], wouldComment: 0 }
      },
    })
    expect(text).not.toContain('- accepted:')
    expect(text).toContain('docs-snapshot: fail')
    expect(code).toBe(1)
  })

  it.each([
    ['an issue count with no logged issue', [], 1, 0],
    ['a comment count with no logged comment', [], 0, 1],
    ['a logged issue with no count', [OPEN_LOG], 0, 0],
    ['a logged comment with no count', [COMMENT_LOG], 0, 0],
    ['a logged issue with no marker', ['would open: a title\n\nno marker'], 1, 0],
    ['a logged comment with no marker', ['would comment on #50:\n\nno marker'], 0, 1],
  ])('fails when the issue step gives %s', async (_, lines: string[], wouldOpen, wouldComment) => {
    const { code, text } = await steps({
      openIssues: async ({ log }) => {
        for (const line of lines) log(line)
        return { opened: [], skipped: 0, wouldOpen, commented: [], wouldComment }
      },
    })
    expect(code).toBe(1)
    expect(text).toContain(
      'The dry run failed: the issue step log does not name one block or more for each issue and comment',
    )
  })
})

describe('the command line', () => {
  it('needs a base, and refuses an unknown option', async () => {
    await expect(api.main([], {})).rejects.toThrow(
      'usage: docs-verify.ts <base> [root] [--repo owner/name]',
    )
    await expect(api.main(['main', '--dry-run'], {})).rejects.toThrow('unknown option --dry-run')
  })

  // An empty base gives an empty diff, and git reads `-S` as an option. Each
  // would pass a head that changes the snapshot.
  it.each([
    ['an empty base', ['']],
    ['a base that starts with a dash', ['-S']],
    ['a third argument', ['main', '.', 'extra']],
  ])('refuses %s', async (_, argv) => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    expect(base).toMatch(/^[0-9a-f]{40}$/)
    await expect(api.main([...argv, root].slice(0, 3), {})).rejects.toThrow(
      'usage: docs-verify.ts <base> [root] [--repo owner/name]',
    )
  })

  it('refuses --repo with no value', async () => {
    await expect(api.main(['main', '.', '--repo'], {})).rejects.toThrow(
      '--repo needs a value, owner/name',
    )
    await expect(api.main(['main', '--repo', '--other'], {})).rejects.toThrow(
      '--repo needs a value, owner/name',
    )
  })

  it('refuses a base that is not a commit', async () => {
    const { root } = await repoWith(refresh(serve(EDIT_HOOKS)))
    await expect(api.main(['no-such-ref', root], {})).rejects.toThrow('rev-parse')
  })

  it('exits 1 when it fails, as a script', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'docs-verify-'))
    dirs.push(root)
    const script = path.join(import.meta.dirname, '../scripts/docs-verify.ts')
    // Node 22.13 to 22.17 needs the flag to run a .ts file.
    const flags = process.features.typescript ? [] : ['--experimental-strip-types']
    const result = spawnSync(process.execPath, [...flags, script, 'no-such-ref', root], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toBe('')
  })
})
