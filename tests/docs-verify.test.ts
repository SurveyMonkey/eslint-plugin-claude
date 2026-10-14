// The snapshot gate runs the docs watch again against the base state of a
// pull request, in dry run. These tests build a real git repository in a
// temporary directory. They inject the docs fetch, the Jev fetch and the gh
// runner, so no test reaches the network or GitHub.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

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

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// The pre-commit hook runs these tests with GIT_DIR and GIT_INDEX_FILE set
// to the repository of the hook. Then a git call here writes to that
// repository, not to the temporary one. So the tests remove each GIT_
// variable. The gate and the git calls below get the clean environment.
for (const name of Object.keys(process.env)) {
  if (name.startsWith('GIT_')) delete process.env[name]
}

// git with no user or system config, so a hook or a signing key on this
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

// Makes a repository with the docs state of `live` in a base commit. Then
// `change` edits the tree, and a head commit stores the edit. Returns the
// root and the SHA of the base commit.
async function repoWith(change: (root: string) => unknown, live: FetchText = serve(PAGE)) {
  const root = mkdtempSync(path.join(tmpdir(), 'docs-verify-'))
  dirs.push(root)
  mkdirSync(path.join(root, 'docs/rules'), { recursive: true })
  writeFileSync(
    path.join(root, 'docs/rules/a-rule.md'),
    `---\ntype: Reference\ndescription: The rule a-rule checks hook names.\n---\n\n# a-rule\n\n[^h]: [Plugins reference: hooks](${URL_}#hooks)\n`,
  )
  writeFileSync(path.join(root, 'docs/rules/index.md'), '# Rules\n')
  writeFileSync(path.join(root, 'docs/rules-inventory.md'), INVENTORY)
  writeFileSync(path.join(root, 'docs/rule-sources.json'), `${JSON.stringify(cited)}\n`)
  await watch.updateState({ root, fetchText: live })
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
  it('fails with no TYPESAFE_API_KEY, and names the cause', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const gh = fakeGh()
    const { code, text } = await verify(
      root,
      base,
      { fetchText: failFetch, run: gh.run },
      { TYPESAFE_API_KEY: '' },
    )
    expect(code).toBe(1)
    expect(text).toContain('TYPESAFE_API_KEY is not set')
    expect(text).toContain('A pull request from a fork or from Dependabot gets no secret')
    expect(gh.calls).toEqual([])
  })

  it('fails when the dry run would open an issue, and names the block', async () => {
    const { root, base } = await repoWith(refresh(serve(EDIT_HOOKS)))
    const summary = path.join(root, 'summary.md')
    const { code, text } = await verify(
      root,
      base,
      { fetchText: serve(EDIT_HOOKS), fetch: fakeJev({ alters: 0.84 }).fetch, run: fakeGh().run },
      { TYPESAFE_API_KEY: KEY, GITHUB_STEP_SUMMARY: summary },
    )
    expect(code).toBe(1)
    const hash = headHash(root, 'hooks')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(text).toContain(`- rule-update: ${URL_} block hooks, hash ${hash}`)
    expect(text).toContain('The dry run would open 1 issue(s) and post 0 comment(s).')
    expect(text).not.toContain(KEY)
    expect(readFileSync(summary, 'utf8')).toContain(
      `- rule-update: ${URL_} block hooks, hash ${hash}`,
    )
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
    expect(text).toContain('The head snapshot is the live docs.')
    expect(text).toContain('docs-snapshot: pass')
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
    expect(gh.calls[0]).toEqual([
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
    const { code, text } = await verify(
      root,
      base,
      {
        fetchText: serve(EDIT_BOTH),
        fetch: fakeJev().fetch,
        run: fakeGh({ groups: { 50: { state: 'closed', comments: [] } } }).run,
      },
      { TYPESAFE_API_KEY: KEY, GITHUB_REPOSITORY: REPO },
      [],
    )
    expect(code).toBe(1)
    expect(text).toContain('The dry run would open 0 issue(s) and post 0 comment(s).')
    expect(text).toContain('1 page(s) of the head snapshot are not the live docs')
    expect(text).toContain('Run `node scripts/docs-watch.ts update` again')
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
    expect(text).toContain(`- ${URL_}: the map hash of "hooks" for a-rule is not the snapshot hash`)
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
    expect(text).toContain('rule-sources.json')
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
  })

  it('fails when the classifier gives no findings or tracked list', async () => {
    const { code, text } = await steps({
      classify: async () => ({ model: 'jev-1.13.0' }) as never,
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
  })

  it('fails when the issue step gives no wouldOpen or wouldComment count', async () => {
    const { code, text } = await steps({
      openIssues: async () => ({ opened: [], skipped: 0, commented: [] }) as never,
    })
    expect(code).toBe(1)
    expect(text).toContain(
      'The dry run failed: the issue step report has no wouldOpen or wouldComment count',
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
