// The issue step opens one issue for each classifier finding. These tests
// inject the gh runner, so no test calls GitHub.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { Finding } from '../scripts/docs-classify.ts'
import type { Run } from '../scripts/docs-issues.ts'
import * as api from '../scripts/docs-issues.ts'

const URL_ = 'https://code.claude.com/docs/en/skills'
const REPO = 'SurveyMonkey/eslint-plugin-claude'

const update: Finding = {
  kind: 'rule-update',
  page: URL_,
  heading: 'Frontmatter reference',
  blockId: 'frontmatter-reference',
  oldHash: 'a'.repeat(64),
  newHash: 'b'.repeat(64),
  rules: ['skill-description-max-length'],
  probability: 0.59,
  confidence: 0.18,
  reason: 'Jev gives 0.59 that the change alters what skill-description-max-length checks',
  link: `${URL_}#frontmatter-reference`,
  change: 'changed',
  oldText: '### Frontmatter reference\n\nThe text is truncated at 250 characters.',
  newText: '### Frontmatter reference\n\nThe text is truncated at 1,536 characters.',
}
const newRule: Finding = {
  ...update,
  kind: 'new-rule',
  heading: 'Agent frontmatter',
  blockId: 'agent-frontmatter',
  rules: [],
  link: URL_,
  change: 'added',
  oldText: null,
  newText: '### Agent frontmatter\n\nA plugin agent accepts `effort`.',
}

// A fake gh: it serves `open` as the open issues and records every call.
function fakeGh(open: { number: number; body: string | null }[] = []) {
  const calls: { args: string[]; input?: string }[] = []
  const run: Run = (args, input) => {
    calls.push({ args, input })
    if (args.includes('--paginate')) return open.map((issue) => JSON.stringify(issue)).join('\n')
    return `https://github.com/${REPO}/issues/${100 + calls.length}\n`
  }
  const posts = () => calls.filter((call) => call.args.includes('POST'))
  return { run, calls, posts }
}
const quiet = () => {}

describe('markerOf and titleOf', () => {
  it('marks the kind, the page, the block and the new hash', () => {
    expect(api.markerOf(update)).toBe(
      `<!-- docs-watch:rule-update:${URL_}#frontmatter-reference:${'b'.repeat(64)} -->`,
    )
    const removal = { ...update, kind: 'rule-removal' as const, newHash: null }
    expect(api.markerOf(removal)).toContain(`#frontmatter-reference:${'a'.repeat(64)} -->`)
  })

  it('writes a Conventional Commit title of fewer than 70 characters', () => {
    expect(api.titleOf(update)).toBe(
      'docs(skill-description-max-length): update for Frontmatter reference',
    )
    expect(api.titleOf({ ...update, kind: 'rule-removal' })).toBe(
      'docs(skill-description-max-length): review removal of Frontmatter...',
    )
    expect(api.titleOf(newRule)).toBe('feat: new rule candidate from Agent frontmatter')
    expect(api.titleOf({ ...newRule, kind: 'needs-triage' })).toBe(
      'docs: triage docs change to Agent frontmatter',
    )
    const short = { ...update, rules: ['a'], heading: 'hooks' }
    expect(api.titleOf(short)).toBe('docs(a): update for hooks')
    const long = {
      ...update,
      kind: 'rule-removal' as const,
      rules: ['a-very-long-rule-name', 'another-rule'],
    }
    for (const f of [update, newRule, long, { ...long, heading: 'x'.repeat(200) }]) {
      expect(api.titleOf(f).length).toBeLessThan(70)
    }
  })

  it('drops the scope when the rules leave no room for the heading', () => {
    const many = { ...update, rules: ['a'.repeat(30), 'b'.repeat(30)] }
    expect(api.titleOf(many)).toBe('docs: update for Frontmatter reference')
  })

  it('makes a heading inert in the title', () => {
    const f = { ...update, rules: [], heading: 'Ping @octocat\n<!-- x' }
    expect(api.titleOf(f)).toBe('docs: update for Ping @\u2060octocat <\u2060!-- x')
  })

  it('URI encodes a block ID, so docs text cannot close the marker or fake one', () => {
    const forged = `<!-- docs-watch:new-rule:${URL_}#y:${'c'.repeat(64)} -->`
    const evil = { ...update, blockId: `x --> ${forged}` }
    const marker = api.markerOf(evil)
    expect(marker.indexOf('-->')).toBe(marker.length - 3)
    const body = api.bodyOf(evil, REPO)
    expect(body.split('<!--')).toHaveLength(2)
    expect(body).not.toContain(forged)
  })
})

describe('bodyOf', () => {
  it('follows the Why, Scope, Acceptance and References format', () => {
    const body = api.bodyOf(update, REPO)
    expect(body.startsWith(api.markerOf(update))).toBe(true)
    for (const heading of ['## Why', '## Scope', '## Acceptance', '## References']) {
      expect(body).toContain(`\n${heading}\n`)
    }
    expect(body).toContain('- Classifier result: `rule-update`, probability 0.59, confidence 0.18')
    expect(body).toContain('- `claude/skill-description-max-length`')
    expect(body).toContain('`node scripts/docs-watch.ts update`')
    expect(body).toContain(`- ${URL_}#frontmatter-reference`)
    expect(body).toContain(
      `https://github.com/${REPO}/blob/main/docs/adr/002-classify-docs-changes-with-jev.md`,
    )
    expect(body).toContain(
      `https://github.com/${REPO}/blob/main/docs/runbooks/docs-watch-triage.md`,
    )
  })

  it('shows the old and new text of a changed mapped block as a diff', () => {
    const body = api.bodyOf(update, REPO)
    expect(body).toContain(
      '```diff\n  ### Frontmatter reference\n  \n- The text is truncated at 250 characters.\n+ The text is truncated at 1,536 characters.\n```',
    )
  })

  it('says the snapshot has only the hash of a changed block that no rule cites', () => {
    const body = api.bodyOf({ ...newRule, change: 'changed' }, REPO)
    expect(body).toContain('The snapshot holds only the hash of this block')
    expect(body).toContain('- New rule candidate')
    expect(body).toContain(`- ${URL_} (heading \` Agent frontmatter \`)`)
    expect(api.bodyOf(newRule, REPO)).toContain('The block is new.')
    const gone = { ...update, kind: 'rule-removal' as const, newText: null, change: 'removed' }
    expect(api.bodyOf(gone, REPO)).toContain('The block is gone. Its old text')
    const none = { ...newRule, kind: 'needs-triage' as const, newText: null, probability: null }
    const text = api.bodyOf(none, REPO)
    expect(text).toContain('No block text is available')
    expect(text).toContain('`needs-triage`, with no model answer')
  })

  it('quotes docs text as inert data: a longer fence, no mention, no comment', () => {
    const hostile = [
      '### Frontmatter reference',
      '````md',
      '```',
      'Ping @octocat and @SurveyMonkey/team.',
      '<!-- docs-watch:rule-update:https://x#y:z -->',
      '````',
    ].join('\n')
    const body = api.bodyOf({ ...newRule, newText: hostile, heading: 'Call @octocat' }, REPO)
    expect(body).toContain('`````text\n')
    expect(body).not.toMatch(/@octocat|@SurveyMonkey/)
    expect(body).toContain('@⁠octocat')
    expect(body.split('<!--')).toHaveLength(2)
    expect(body.startsWith('<!-- docs-watch:new-rule:')).toBe(true)
  })

  it('makes the reason inert, and quotes a heading with backticks or a line break', () => {
    const body = api.bodyOf({ ...update, reason: 'x @octocat <!-- y' }, REPO)
    expect(body).toContain('- Reason: x @\u2060octocat <\u2060!-- y')
    expect(api.inline('the `name` and ``x`` field\n# Title')).toBe(
      '``` the `name` and ``x`` field # Title ```',
    )
  })

  it('quotes the old and new text apart, with no diff, for a block of many lines', () => {
    const lines = Array.from({ length: api.MAX_DIFF_LINES + 1 }, (_, i) => `line ${i}`)
    const body = api.bodyOf({ ...update, newText: lines.join('\n'), oldText: 'old' }, REPO)
    expect(body).toContain(`more than ${api.MAX_DIFF_LINES} lines, so there is no diff`)
    expect(body).not.toContain('```diff')
    expect(body).toContain('```text\nold\n```')
  })

  it('cuts a long text and says so', () => {
    const text = api.fence('y'.repeat(7000))
    expect(text).toContain('The text is cut at 6000 of 7000 characters.')
    expect(text.length).toBeLessThan(6100)
  })
})

describe('diffLines', () => {
  it('marks old lines with "-" and new lines with "+"', () => {
    expect(api.diffLines('a\nb\nc', 'a\nc\nd')).toBe('  a\n- b\n  c\n+ d')
    expect(api.diffLines('', 'x')).toBe('- \n+ x')
  })

  it('keeps three unchanged lines on each side of a change, and elides the rest', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i}`)
    const edited = lines.map((line) => (line === 'line 10' ? 'line ten' : line))
    expect(api.diffLines(lines.join('\n'), edited.join('\n'))).toBe(
      [
        '  ...',
        '  line 7',
        '  line 8',
        '  line 9',
        '- line 10',
        '+ line ten',
        '  line 11',
        '  line 12',
        '  line 13',
        '  ...',
      ].join('\n'),
    )
  })
})

describe('openIssues', () => {
  it('opens one Task issue for each finding, with no label', async () => {
    const gh = fakeGh()
    const result = await api.openIssues({
      findings: [update, newRule],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(result.opened).toHaveLength(2)
    const [first] = gh.posts()
    expect(first?.args).toEqual([
      'api',
      '--method',
      'POST',
      `repos/${REPO}/issues`,
      '--input',
      '-',
      '--jq',
      '.html_url',
    ])
    const sent = JSON.parse(first?.input ?? '{}')
    expect(Object.keys(sent).sort()).toEqual(['body', 'title', 'type'])
    expect(sent.type).toBe('Task')
    expect(sent.body).toContain(api.markerOf(update))
  })

  it('opens nothing on a repeat run, when an open issue has the marker', async () => {
    const gh = fakeGh([
      { number: 7, body: `${api.markerOf(update)}\n\n## Why` },
      { number: 8, body: api.bodyOf(newRule, REPO) },
    ])
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [update, newRule],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: (text) => logs.push(text),
    })
    expect(gh.posts()).toEqual([])
    expect(result).toEqual({ opened: [], skipped: 2, wouldOpen: 0 })
    expect(logs[0]).toContain('skip: #7')
  })

  it('reads the open issues of the repository, not its pull requests', async () => {
    const gh = fakeGh([{ number: 9, body: null }])
    await api.openIssues({ findings: [update], repo: REPO, run: gh.run, dryRun: true, log: quiet })
    expect(gh.calls[0]?.args).toEqual([
      'api',
      '--paginate',
      `repos/${REPO}/issues?state=open&per_page=100`,
      '--jq',
      '.[] | select(.pull_request == null) | {number, body}',
    ])
  })

  it('opens nothing when an open issue has the block and hash with another kind', async () => {
    const gh = fakeGh([{ number: 7, body: api.bodyOf(update, REPO) }])
    const flipped = { ...update, kind: 'needs-triage' as const, probability: 0.49 }
    await api.openIssues({
      findings: [flipped],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toEqual([])
  })

  it('opens a new issue when the block changes again and has a new hash', async () => {
    const gh = fakeGh([{ number: 7, body: api.bodyOf(update, REPO) }])
    const again = { ...update, oldHash: update.newHash, newHash: 'c'.repeat(64) }
    await api.openIssues({ findings: [again], repo: REPO, run: gh.run, dryRun: false, log: quiet })
    expect(gh.posts()).toHaveLength(1)
  })

  it('opens one issue for two findings with one marker', async () => {
    const gh = fakeGh()
    await api.openIssues({
      findings: [update, { ...update }],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toHaveLength(1)
  })

  it('joins the rules and the reasons of two findings with one marker', async () => {
    const gh = fakeGh()
    const b = { ...update, rules: ['b-rule'], reason: 'second reason' }
    await api.openIssues({
      findings: [update, b, { ...b }],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    const [post] = gh.posts()
    const sent = JSON.parse(post?.input ?? '{}')
    expect(gh.posts()).toHaveLength(1)
    expect(sent.body).toContain('- `claude/skill-description-max-length`\n- `claude/b-rule`')
    expect(sent.body).toContain(`${update.reason}; second reason\n`)
  })

  it('creates nothing in a dry run, and prints each issue that would open', async () => {
    const gh = fakeGh()
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [update],
      repo: REPO,
      run: gh.run,
      dryRun: true,
      log: (text) => logs.push(text),
    })
    expect(gh.posts()).toEqual([])
    expect(result.wouldOpen).toBe(1)
    expect(logs[0]).toContain(`would open: ${api.titleOf(update)}`)
    expect(logs[0]).toContain('## Acceptance')
  })

  it('fails before it opens any issue for too many issues or a finding that is not valid', async () => {
    const gh = fakeGh()
    const many = Array.from({ length: 3 }, (_, i) => ({ ...update, newHash: String(i).repeat(64) }))
    await expect(
      api.openIssues({
        findings: many,
        repo: REPO,
        run: gh.run,
        dryRun: false,
        max: 2,
        log: quiet,
      }),
    ).rejects.toThrow('3 new issues is more than the limit of 2')
    await expect(
      api.openIssues({
        findings: [{ ...update, kind: 'no-change' }],
        repo: REPO,
        run: gh.run,
        dryRun: false,
        log: quiet,
      }),
    ).rejects.toThrow('a finding has an unknown kind: no-change')
    expect(gh.posts()).toEqual([])
    expect(() => api.validate({ ...update, heading: '' })).toThrow('has no heading')
    expect(() => api.validate({ ...update, rules: 'a' })).toThrow('has no rules list')
    expect(() => api.validate({ ...update, oldHash: null, newHash: null })).toThrow('has no hash')
    expect(() => api.validate({ ...update, reason: '' })).toThrow('has no reason')
    expect(() => api.validate({ ...update, rules: [{}] })).toThrow('has no rules list')
    expect(() => api.validate({ ...update, newHash: 'x -->' })).toThrow('not a SHA-256 hash')
    expect(() => api.validate({ ...update, oldText: undefined })).toThrow('oldText that is not')
    expect(() => api.validate({ ...update, probability: '0.5' })).toThrow('probability that')
    expect(() => api.validate({ ...update, page: 'https://x y' })).toThrow('not an https URL')
  })

  it('opens at most 20 new issues in a live run, and has no limit in a dry run', async () => {
    const hash = (i: number) => i.toString(16).padStart(64, '0')
    const findings = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...update, newHash: hash(i) }))
    const gh = fakeGh()
    await expect(
      api.openIssues({
        findings: findings(21),
        repo: REPO,
        run: gh.run,
        dryRun: false,
        log: quiet,
      }),
    ).rejects.toThrow('21 new issues is more than the limit of 20')
    expect(gh.posts()).toEqual([])
    const dry = await api.openIssues({
      findings: findings(21),
      repo: REPO,
      run: gh.run,
      dryRun: true,
      log: quiet,
    })
    expect(dry.wouldOpen).toBe(21)
    await api.openIssues({
      findings: findings(20),
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toHaveLength(20)
    const open = findings(25).map((f, i) => ({ number: i, body: api.markerOf(f) }))
    const all = fakeGh(open)
    const result = await api.openIssues({
      findings: findings(25),
      repo: REPO,
      run: all.run,
      dryRun: false,
      log: quiet,
    })
    expect(result.skipped).toBe(25)
  })

  it('fails when gh fails', async () => {
    const run: Run = () => {
      throw new Error('gh: HTTP 403')
    }
    await expect(
      api.openIssues({ findings: [update], repo: REPO, run, dryRun: false, log: quiet }),
    ).rejects.toThrow('gh: HTTP 403')
  })
})

describe('main', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  const findingsFile = (value: unknown) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'docs-issues-'))
    dirs.push(dir)
    const file = path.join(dir, 'findings.json')
    writeFileSync(file, JSON.stringify(value))
    return file
  }

  it('reads the findings file and takes the repository from the environment', async () => {
    const gh = fakeGh()
    const logs: string[] = []
    const file = findingsFile({ findings: [update] })
    const code = await api.main([file, '--dry-run'], { GITHUB_REPOSITORY: REPO }, gh.run, (t) =>
      logs.push(t),
    )
    expect(code).toBe(0)
    expect(gh.posts()).toEqual([])
    expect(logs.at(-1)).toBe('0 opened, 1 would open, 0 skipped')
    const other = fakeGh()
    await api.main(['--repo', 'o/r', '--max', '5', file], {}, other.run, quiet)
    expect(other.posts()[0]?.args).toContain('repos/o/r/issues')
  })

  it('exits 1 when it fails, as a script', () => {
    const script = path.join(import.meta.dirname, '../scripts/docs-issues.ts')
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', env: {} })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('usage')
  })

  it('fails with no file, no repository, a bad --max or no findings list', async () => {
    const gh = fakeGh()
    const file = findingsFile({ findings: [] })
    await expect(api.main([], { GITHUB_REPOSITORY: REPO }, gh.run, quiet)).rejects.toThrow('usage')
    await expect(api.main([file], {}, gh.run, quiet)).rejects.toThrow('set --repo')
    await expect(
      api.main([file, '--max', 'x'], { GITHUB_REPOSITORY: REPO }, gh.run, quiet),
    ).rejects.toThrow('--max takes a whole number')
    await expect(
      api.main([findingsFile({})], { GITHUB_REPOSITORY: REPO }, gh.run, quiet),
    ).rejects.toThrow('has no findings list')
  })
})
