// The issue step opens one issue for each changed block. These tests inject
// the gh runner, so no test calls GitHub.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { Finding, JevFetch, Tracked } from '../scripts/docs-classify.ts'
import * as classify from '../scripts/docs-classify.ts'
import type { Run } from '../scripts/docs-issues.ts'
import * as api from '../scripts/docs-issues.ts'
import type { SourceMap } from '../scripts/docs-watch.ts'
import * as watch from '../scripts/docs-watch.ts'

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
  it('marks the kind, the page, the block, the new hash and the rules', () => {
    expect(api.markerOf(update)).toBe(
      `<!-- docs-watch:rule-update:${URL_}#frontmatter-reference:${'b'.repeat(64)} rules=skill-description-max-length -->`,
    )
    const removal = { ...update, kind: 'rule-removal' as const, newHash: null, rules: ['a', 'b'] }
    expect(api.markerOf(removal)).toContain(
      `#frontmatter-reference:gone:${'a'.repeat(64)} rules=a,b -->`,
    )
    expect(api.markerOf(newRule)).toBe(
      `<!-- docs-watch:new-rule:${URL_}#agent-frontmatter:${'b'.repeat(64)} -->`,
    )
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
    // "docs(<rule>): update for " with 65 or 66 characters leaves room for 4
    // or 3 characters of the heading.
    const room = (n: number) => ({ ...update, rules: ['r'.repeat(n - 19)] })
    expect(api.titleOf(room(65))).toBe(`docs(${'r'.repeat(46)}): update for F...`)
    expect(api.titleOf(room(66))).toBe('docs: update for Frontmatter reference')
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
    expect(body).toContain(`- ${URL_} (heading \`Agent frontmatter\`)`)
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
      '```the `name` and ``x`` field # Title```',
    )
  })

  it('quotes the old and new text apart, with no diff, for a block of many lines', () => {
    expect(api.MAX_DIFF_LINES).toBe(1000)
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n')
    const body = api.bodyOf({ ...update, newText: lines(1001), oldText: 'old' }, REPO)
    expect(body).toContain('One text of the block has more than 1000 lines, so there is no diff')
    expect(body).not.toContain('```diff')
    expect(body).toContain('```text\nold\n```')
    const old = api.bodyOf({ ...update, oldText: lines(1001), newText: 'new' }, REPO)
    expect(old).not.toContain('```diff')
    expect(api.bodyOf({ ...update, oldText: lines(1000), newText: 'new' }, REPO)).toContain(
      '```diff',
    )
  })

  it('pads inline code with a space only when the text starts or ends with a backtick', () => {
    expect(api.inline('Frontmatter reference')).toBe('`Frontmatter reference`')
    expect(api.inline('`hooks`')).toBe('`` `hooks` ``')
    expect(api.inline('the `hooks` key')).toBe('``the `hooks` key``')
    expect(api.inline('`hooks` key')).toBe('`` `hooks` key ``')
    expect(api.inline('key `hooks`')).toBe('`` key `hooks` ``')
    const body = api.bodyOf(update, REPO)
    expect(body).toContain('- Heading: `Frontmatter reference` (block `frontmatter-reference`)')
    // The marker does not use inline code, so it stays the same.
    expect(body.split('\n')[0]).toBe(
      `<!-- docs-watch:rule-update:${URL_}#frontmatter-reference:${'b'.repeat(64)} rules=skill-description-max-length -->`,
    )
  })

  it('shows the full old and new section in two collapsed blocks after the diff', () => {
    const body = api.bodyOf(update, REPO)
    const before = [
      '<details><summary>Before: the old section</summary>',
      '',
      `\`\`\`text\n${update.oldText}\n\`\`\``,
      '',
      '</details>',
    ].join('\n')
    const after = [
      '<details><summary>After: the new section</summary>',
      '',
      `\`\`\`text\n${update.newText}\n\`\`\``,
      '',
      '</details>',
    ].join('\n')
    const diff = body.indexOf('```diff')
    expect(diff).toBeGreaterThan(-1)
    expect(body.indexOf(before)).toBeGreaterThan(diff)
    expect(body.indexOf(after)).toBeGreaterThan(body.indexOf(before))
    expect(body.indexOf('## Scope')).toBeGreaterThan(body.indexOf(after))
  })

  it('quotes hostile text in each section with a safe fence, no mention and no comment', () => {
    const hostile = (word: string) =>
      [
        `### ${word}`,
        '````md',
        '```',
        `Ping @octocat ${word}.`,
        '<!-- docs-watch:x -->',
        '````',
      ].join('\n')
    const body = api.bodyOf({ ...update, oldText: hostile('old'), newText: hostile('new') }, REPO)
    for (const summary of ['Before: the old section', 'After: the new section']) {
      const start = body.indexOf(`<details><summary>${summary}</summary>\n\n\`\`\`\`\`text\n`)
      expect(start).toBeGreaterThan(-1)
      const end = body.indexOf('</details>', start)
      expect(body.slice(start, end)).toMatch(/\n`````\n\n$/)
    }
    expect(body).not.toMatch(/@octocat/)
    expect(body.split('<!--')).toHaveLength(2)
  })

  it('cuts each section at the cap, with the cut note', () => {
    const body = api.bodyOf(
      { ...update, oldText: 'o'.repeat(7000), newText: 'n'.repeat(7000) },
      REPO,
    )
    const note = `The text is cut at ${api.MAX_SECTION} of 7000 characters. Read the page for the rest.`
    const before = body.slice(body.indexOf('Before: the old section'), body.indexOf('After:'))
    const after = body.slice(body.indexOf('After: the new section'), body.indexOf('## Scope'))
    for (const section of [before, after]) {
      expect(section).toContain(note)
      expect(section).toMatch(/\n\n<\/details>\n/)
    }
    expect(api.MAX_SECTION).toBe(5000)
    expect(before).toContain('o'.repeat(api.MAX_SECTION))
    expect(before).not.toContain('o'.repeat(api.MAX_SECTION + 1))
  })

  it('adds no section to a long block, or to an added or gone block', () => {
    const lines = Array.from({ length: 1001 }, (_, i) => `line ${i}`).join('\n')
    const long = api.bodyOf({ ...update, oldText: 'old', newText: lines }, REPO)
    expect(long).not.toContain('<details>')
    expect(long.split('```text\nold\n```')).toHaveLength(2)
    expect(api.bodyOf(newRule, REPO)).not.toContain('<details>')
    const gone = { ...update, kind: 'rule-removal' as const, newText: null, change: 'removed' }
    expect(api.bodyOf(gone, REPO)).not.toContain('<details>')
  })

  it('keeps the worst-case body under 60,000 characters', () => {
    // Long lines with long backtick runs make each fence as long as it can be.
    const ticks = '`'.repeat(20_000)
    const text = (word: string) =>
      [
        ticks,
        ...Array.from({ length: 400 }, (_, i) => `${word} ${i} ${'`'.repeat(50)} @x <!--`),
      ].join('\n')
    const rules = Array.from({ length: 12 }, (_, i) => `a-rule-with-a-long-name-${i}`)
    const worst: Finding = {
      ...update,
      heading: `${'`'.repeat(10)} ${'Heading '.repeat(40)}`,
      blockId: 'b'.repeat(200),
      rules,
      reason: rules
        .map((rule) => `rule-update: Jev gives 0.9 that the change alters what ${rule} checks`)
        .join('; '),
      oldText: text('old'),
      newText: text('new'),
    }
    const body = api.bodyOf(worst, REPO)
    expect(body).toContain('<details><summary>After: the new section</summary>')
    expect(body.length).toBeLessThan(60_000)
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
  it('opens one Task issue for each finding, with the claude-docs-change label', async () => {
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
    expect(Object.keys(sent).sort()).toEqual(['body', 'labels', 'title', 'type'])
    expect(sent.type).toBe('Task')
    expect(sent.labels).toEqual(['claude-docs-change'])
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
    expect(result).toEqual({
      opened: [],
      skipped: 2,
      wouldOpen: 0,
      commented: [],
      wouldComment: 0,
    })
    expect(logs[0]).toContain('skip: #7')
    const twice = await api.openIssues({
      findings: [update, { ...update, reason: 'another reason' }],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(twice).toEqual({
      opened: [],
      skipped: 2,
      wouldOpen: 0,
      commented: [],
      wouldComment: 0,
    })
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

  it('reads the marker of an open issue of each kind', async () => {
    for (const kind of api.KINDS) {
      const f = { ...update, kind }
      const gh = fakeGh([{ number: 7, body: api.markerOf(f) }])
      await api.openIssues({ findings: [f], repo: REPO, run: gh.run, dryRun: false, log: quiet })
      expect(gh.posts()).toEqual([])
    }
  })

  it('opens an issue for a rule that the open issue for the block does not name', async () => {
    const gh = fakeGh([{ number: 7, body: api.bodyOf(update, REPO) }])
    const logs: string[] = []
    const both = { ...update, rules: [...update.rules, 'b-rule'] }
    await api.openIssues({
      findings: [both],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: (text) => logs.push(text),
    })
    expect(gh.posts()).toHaveLength(1)
    expect(logs[0]).toContain('open: #7 has')
    expect(logs[0]).toContain('but not b-rule')
    // Two open issues that name the rules between them stop a new issue.
    const b = { ...update, rules: ['b-rule'] }
    const two = fakeGh([
      { number: 7, body: api.bodyOf(update, REPO) },
      { number: 8, body: api.bodyOf(b, REPO) },
    ])
    await api.openIssues({ findings: [both], repo: REPO, run: two.run, dryRun: false, log: quiet })
    expect(two.posts()).toEqual([])
  })

  it('does not match the issue for new text with the removal of that block', async () => {
    // The snapshot took the new text, then the block went away.
    const gh = fakeGh([{ number: 7, body: api.bodyOf(update, REPO) }])
    const removal: Finding = {
      ...update,
      kind: 'rule-removal',
      oldHash: update.newHash,
      newHash: null,
      change: 'removed',
      newText: null,
    }
    await api.openIssues({
      findings: [removal],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toHaveLength(1)
  })

  it('opens the rest on the next run after gh fails', async () => {
    const other = { ...newRule, newHash: 'c'.repeat(64) }
    const open: { number: number; body: string | null }[] = []
    let posts = 0
    const run: Run = (args, input) => {
      if (args.includes('--paginate')) return open.map((issue) => JSON.stringify(issue)).join('\n')
      posts += 1
      if (posts === 2) throw new Error('gh: HTTP 502')
      open.push({ number: posts, body: JSON.parse(input ?? '{}').body })
      return `https://github.com/${REPO}/issues/${posts}\n`
    }
    const findings = [
      update,
      { ...update, kind: 'needs-triage' as const, rules: ['b-rule'] },
      other,
    ]
    await expect(
      api.openIssues({ findings, repo: REPO, run, dryRun: false, log: quiet }),
    ).rejects.toThrow('HTTP 502')
    const again = await api.openIssues({ findings, repo: REPO, run, dryRun: false, log: quiet })
    expect(again.opened).toHaveLength(1)
    expect(open.map((issue) => issue.body?.split('\n')[0])).toEqual([
      api.markerOf({ ...update, rules: [...update.rules, 'b-rule'] }),
      api.markerOf(other),
    ])
  })

  it('opens a new issue when the block changes again and has a new hash', async () => {
    const gh = fakeGh([{ number: 7, body: api.bodyOf(update, REPO) }])
    const again = { ...update, oldHash: update.newHash, newHash: 'c'.repeat(64) }
    await api.openIssues({ findings: [again], repo: REPO, run: gh.run, dryRun: false, log: quiet })
    expect(gh.posts()).toHaveLength(1)
  })

  it('opens one issue for two findings with one marker', async () => {
    const gh = fakeGh()
    const result = await api.openIssues({
      findings: [update, { ...update }],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toHaveLength(1)
    expect(result.skipped).toBe(0)
  })

  it('opens one issue for findings of two kinds on one block, named by the first kind', async () => {
    const gh = fakeGh()
    const triage = { ...update, kind: 'needs-triage' as const, rules: ['b-rule'], reason: 'b' }
    const cand = { ...update, kind: 'new-rule' as const, rules: [], reason: 'c' }
    await api.openIssues({
      findings: [cand, triage, update],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.posts()).toHaveLength(1)
    const sent = JSON.parse(gh.posts()[0]?.input ?? '{}')
    expect(sent.title).toBe('docs(b-rule,skill-description-max-length): update for Frontmatter...')
    expect(sent.body).toContain(
      `- Reason: new-rule: c; needs-triage: b; rule-update: ${update.reason}\n`,
    )
    const removal = { ...update, kind: 'rule-removal' as const, rules: ['c-rule'] }
    expect(api.merge([update, removal, triage]).kind).toBe('rule-removal')
    expect(api.merge([cand, triage]).kind).toBe('needs-triage')
    expect(() => api.merge([])).toThrow('one finding or more')
  })

  it('keeps the highest probability of the kind that names the issue', () => {
    const code = { ...update, kind: 'rule-removal' as const, probability: null, confidence: null }
    const jev = { ...code, rules: ['b-rule'], probability: 0.9, confidence: 0.8, reason: 'j' }
    const low = { ...jev, probability: 0.7, confidence: 0.4 }
    const merged = api.merge([code, low, jev, { ...update, probability: 0.99 }])
    expect([merged.probability, merged.confidence]).toEqual([0.9, 0.8])
  })

  it('keeps each part of a reason once, and every rule once', () => {
    const a = { ...update, rules: ['a', 'b'], reason: 'x; y' }
    const merged = api.merge([a, { ...a, rules: ['b', 'c'], reason: 'y; z' }, { ...a }])
    expect(merged.reason).toBe('x; y; z')
    expect(merged.rules).toEqual(['a', 'b', 'c'])
    expect(a.rules).toEqual(['a', 'b'])
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
    expect(() => api.validate({ ...update, rules: ['a', {}] })).toThrow('has no rules list')
    expect(() => api.validate({ ...update, newHash: 'x -->' })).toThrow('not a SHA-256 hash')
    const tail = `${'a'.repeat(64)} --> <!-- x`
    for (const hash of [tail, `x${'a'.repeat(64)}`, 'A'.repeat(64), 'a'.repeat(63)]) {
      expect(() => api.validate({ ...update, oldHash: hash })).toThrow('oldHash that is not')
      expect(() => api.validate({ ...update, newHash: hash })).toThrow('newHash that is not')
    }
    expect(() => api.validate({ ...update, newHash: undefined })).toThrow('newHash that is not')
    for (const field of ['oldText', 'newText', 'probability', 'confidence']) {
      expect(() => api.validate({ ...update, [field]: undefined })).toThrow(`${field} that is not`)
    }
    expect(() => api.validate({ ...update, probability: '0.5' })).toThrow('probability that')
    for (const page of ['https://x y', 'see https://x', 'http://x']) {
      expect(() => api.validate({ ...update, page })).toThrow('page that is not an https URL')
      expect(() => api.validate({ ...update, link: page })).toThrow('link that is not an https')
    }
    for (const rules of [[''], ['a`b'], ['a b'], ['a', 'a']]) {
      expect(() => api.validate({ ...update, rules })).toThrow('rule ID that is not valid')
    }
    for (const kind of ['rule-update', 'rule-removal']) {
      expect(() => api.validate({ ...update, kind, rules: [] })).toThrow('names no rule')
    }
    expect(() => api.validate({ ...update, change: 'x <!-- y' })).toThrow('unknown change')
    for (const f of [update, newRule, { ...newRule, kind: 'needs-triage', change: 'new source' }]) {
      expect(() => api.validate(f)).not.toThrow()
    }
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

const HOOKS = 'https://code.claude.com/docs/en/hooks'
const common: Tracked = {
  page: HOOKS,
  heading: 'Common fields',
  blockId: 'common-fields',
  change: 'changed',
  oldHash: 'c'.repeat(64),
  newHash: 'd'.repeat(64),
  oldText: null,
  newText: '#### Common fields\n\nThese fields apply to all hook types.',
  sections: [{ section: 'Hooks', rules: ['hooks-config-schema', 'hooks-if-condition'] }],
}
const exits: Tracked = {
  ...common,
  heading: 'Other exit codes',
  blockId: 'other-exit-codes',
  newHash: 'e'.repeat(64),
  newText: '#### Other exit codes\n\nExit code 1 is a non-blocking error.',
  sections: [{ section: 'Hooks', rules: ['hooks-script-exists'] }],
}
// The new-rule finding that the classifier gives for the `common` block.
const commonRule: Finding = {
  ...newRule,
  page: HOOKS,
  heading: 'Common fields',
  blockId: 'common-fields',
  oldHash: common.oldHash,
  newHash: common.newHash,
  change: 'changed',
  link: HOOKS,
  probability: 0.79,
  confidence: 0.58,
  reason: 'Jev gives 0.79 that the block states a requirement a lint check can measure',
  newText: common.newText,
}

// A fake gh for the comment path: `groups` gives the state and the comment
// bodies of each group issue, and `open` gives the open issues.
function groupGh(
  groups: Record<number, { state: string; comments?: (string | null)[] }>,
  open: { number: number; body: string | null }[] = [],
) {
  const calls: { args: string[]; input?: string }[] = []
  const run: Run = (args, input) => {
    calls.push({ args, input })
    const endpoint = args.find((arg) => arg.startsWith('repos/')) ?? ''
    const comments = /^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/comments/.exec(endpoint)
    const issue = /^repos\/[^/]+\/[^/]+\/issues\/(\d+)$/.exec(endpoint)
    if (args.includes('POST')) return `https://github.com/${REPO}/issues/${comments?.[1] ?? 1}\n`
    if (comments) {
      const bodies = groups[Number(comments[1])]?.comments ?? []
      return bodies.map((body) => JSON.stringify({ body })).join('\n')
    }
    if (issue) return `${groups[Number(issue[1])]?.state}\n`
    if (args.includes('--paginate')) return open.map((one) => JSON.stringify(one)).join('\n')
    throw new Error(`unexpected gh call: ${args.join(' ')}`)
  }
  const posts = () => calls.filter((call) => call.args.includes('POST'))
  const commentPosts = () =>
    posts().filter((call) => call.args.some((a) => a.endsWith('/comments')))
  const issuePosts = () => posts().filter((call) => call.args.includes(`repos/${REPO}/issues`))
  return { run, calls, posts, commentPosts, issuePosts }
}
// A live run of the issue step on a fake gh, with no log.
const live = (gh: { run: Run }, tracked: unknown[], findings: unknown[] = []) =>
  api.openIssues({ findings, tracked, repo: REPO, run: gh.run, dryRun: false, log: quiet })

describe('the group comment path for tracked blocks', () => {
  it('posts one comment on the open group issue, with a marker for each block, and opens no issue', async () => {
    const gh = groupGh({ 10: { state: 'open' } })
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [commonRule],
      tracked: [common, exits],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: (text) => logs.push(text),
    })
    expect(gh.calls.slice(0, 2).map((c) => c.args)).toEqual([
      ['api', `repos/${REPO}/issues/10`, '--jq', '.state'],
      [
        'api',
        '--paginate',
        `repos/${REPO}/issues/10/comments?per_page=100`,
        '--jq',
        '.[] | {body}',
      ],
    ])
    expect(gh.issuePosts()).toEqual([])
    const [post] = gh.commentPosts()
    expect(gh.commentPosts()).toHaveLength(1)
    expect(post?.args).toEqual([
      'api',
      '--method',
      'POST',
      `repos/${REPO}/issues/10/comments`,
      '--input',
      '-',
      '--jq',
      '.html_url',
    ])
    const { body } = JSON.parse(post?.input ?? '{}') as { body: string }
    expect(body.split('\n').slice(0, 3)).toEqual([
      `<!-- docs-watch-tracked:${HOOKS}#common-fields:${'d'.repeat(64)} -->`,
      `<!-- docs-watch-tracked:${HOOKS}#other-exit-codes:${'e'.repeat(64)} -->`,
      '',
    ])
    expect(body.match(/<!-- docs-watch-tracked:/g)).toHaveLength(2)
    expect(body).toContain('- Rows: `hooks-config-schema`, `hooks-if-condition`')
    expect(body).toContain('- Rows: `hooks-script-exists`')
    expect(body).toContain('These fields apply to all hook types.')
    expect(body).toContain('The snapshot holds only the hash of this block')
    expect(result).toEqual({
      opened: [],
      skipped: 1,
      wouldOpen: 0,
      commented: [`https://github.com/${REPO}/issues/10`],
      wouldComment: 0,
    })
    expect(logs.some((l) => l.startsWith('comment: ') && l.includes('common-fields'))).toBe(true)
  })

  it('posts nothing and opens nothing on a second run, when the comment has the markers', async () => {
    const first = groupGh({ 10: { state: 'open' } })
    await api.openIssues({
      findings: [commonRule],
      tracked: [common, exits],
      repo: REPO,
      run: first.run,
      dryRun: false,
      log: quiet,
    })
    const posted = (JSON.parse(first.commentPosts()[0]?.input ?? '{}') as { body: string }).body
    const comments = [null, 'A person wrote this.', posted]
    const second = groupGh({ 10: { state: 'open', comments } })
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [commonRule],
      tracked: [common, exits],
      repo: REPO,
      run: second.run,
      dryRun: false,
      log: (text) => logs.push(text),
    })
    expect(second.posts()).toEqual([])
    expect(result.commented).toEqual([])
    expect(logs).toContain('skip: #10 already has 2 tracked block(s)')
    // Only the new block of a later run goes in the next comment.
    const later = { ...exits, newHash: 'f'.repeat(64) }
    const third = groupGh({ 10: { state: 'open', comments: [posted] } })
    await api.openIssues({
      findings: [],
      tracked: [common, later],
      repo: REPO,
      run: third.run,
      dryRun: false,
      log: quiet,
    })
    const next = (JSON.parse(third.commentPosts()[0]?.input ?? '{}') as { body: string }).body
    expect(next.match(/<!-- docs-watch-tracked:/g)).toHaveLength(1)
    expect(next).toContain(api.trackedMarkerOf(later))
  })

  it('opens the new-rule issue with the rows line when the group issue is closed', async () => {
    const gh = groupGh({ 10: { state: 'closed' } })
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [commonRule],
      tracked: [common],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: (text) => logs.push(text),
    })
    expect(gh.commentPosts()).toEqual([])
    expect(gh.calls.some((c) => c.args.some((a) => a.includes('/comments')))).toBe(false)
    expect(result.opened).toHaveLength(1)
    const sent = JSON.parse(gh.issuePosts()[0]?.input ?? '{}') as { title: string; body: string }
    expect(sent.title).toBe('feat: new rule candidate from Common fields')
    expect(sent.body).toContain(api.markerOf(commonRule))
    expect(sent.body).toContain(
      '- Inventory rows that cite the block: Hooks: `hooks-config-schema`, `hooks-if-condition`. Their group issues are closed.',
    )
    expect(logs).toContain('closed: #10, so no comment for 1 tracked block(s)')
    // A tracked block with no finding and a closed group issue gets nothing.
    const none = groupGh({ 10: { state: 'closed' } })
    await live(none, [common])
    expect(none.posts()).toEqual([])
  })

  it('posts on the open group issue and opens no issue when one of two group issues is closed', async () => {
    const both: Tracked = {
      ...common,
      sections: [
        { section: 'Hooks', rules: ['hooks-config-schema'] },
        { section: 'Settings', rules: ['settings-schema'] },
      ],
    }
    const gh = groupGh({ 10: { state: 'open' }, 14: { state: 'closed' } })
    const result = await api.openIssues({
      findings: [commonRule],
      tracked: [both],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.issuePosts()).toEqual([])
    expect(gh.commentPosts().map((c) => c.args[3])).toEqual([`repos/${REPO}/issues/10/comments`])
    const { body } = JSON.parse(gh.commentPosts()[0]?.input ?? '{}') as { body: string }
    expect(body).toContain('- Rows: `hooks-config-schema`')
    expect(body).not.toContain('settings-schema')
    expect(result.skipped).toBe(1)
    // Each section posts on its own group issue.
    const open = groupGh({ 10: { state: 'open' }, 14: { state: 'open' } })
    await live(open, [both])
    expect(open.commentPosts().map((c) => c.args[3])).toEqual([
      `repos/${REPO}/issues/10/comments`,
      `repos/${REPO}/issues/14/comments`,
    ])
  })

  it('maps each inventory section to its group issue', async () => {
    const groups = {
      'Skills and commands': 50,
      'Subagents and output styles': 9,
      Hooks: 10,
      'Plugin manifest and layout': 11,
      'Marketplace manifest': 12,
      'CLAUDE.md, rules and memory': 13,
      Settings: 14,
      'Permissions and sandbox': 15,
      'MCP and LSP servers': 16,
    }
    for (const [section, issue] of Object.entries(groups)) {
      const gh = groupGh({ [issue]: { state: 'open' } })
      const t = { ...common, sections: [{ section, rules: ['a-rule'] }] }
      await live(gh, [t])
      const endpoints = gh.commentPosts().map((c) => c.args[3])
      expect(endpoints, section).toEqual([`repos/${REPO}/issues/${issue}/comments`])
    }
  })

  it('fails before any gh call for a section with no group issue', async () => {
    for (const section of ['Agent teams', 'toString', 'hooks']) {
      const gh = groupGh({ 10: { state: 'open' } })
      await expect(
        api.openIssues({
          findings: [commonRule],
          tracked: [common, { ...exits, sections: [{ section, rules: ['a-rule'] }] }],
          repo: REPO,
          run: gh.run,
          dryRun: false,
          log: quiet,
        }),
      ).rejects.toThrow(`the inventory section "${section}" has no group issue`)
      expect(gh.calls).toEqual([])
    }
  })

  it('fails before it posts for a group issue state that is not open or closed', async () => {
    const gh = groupGh({ 10: { state: '' } })
    await expect(live(gh, [common])).rejects.toThrow(
      'issue #10 has a state that is not open or closed',
    )
    expect(gh.posts()).toEqual([])
  })

  it('prints each comment in a dry run, posts none, and does not count comments toward --max', async () => {
    const gh = groupGh({ 10: { state: 'open' } })
    const logs: string[] = []
    const result = await api.openIssues({
      findings: [commonRule],
      tracked: [common],
      repo: REPO,
      run: gh.run,
      dryRun: true,
      log: (text) => logs.push(text),
    })
    expect(gh.posts()).toEqual([])
    expect(result.wouldComment).toBe(1)
    expect(result.wouldOpen).toBe(0)
    const printed = logs.find((l) => l.startsWith('would comment on #10:'))
    expect(printed).toContain(api.trackedMarkerOf(common))
    const live = groupGh({ 10: { state: 'open' } })
    const capped = await api.openIssues({
      findings: [],
      tracked: [common, exits],
      repo: REPO,
      run: live.run,
      dryRun: false,
      max: 0,
      log: quiet,
    })
    expect(capped.commented).toHaveLength(1)
  })

  it('opens an issue for a finding that names a rule, on a tracked block with an open group issue', async () => {
    const gh = groupGh({ 10: { state: 'open' } })
    const update: Finding = { ...commonRule, kind: 'rule-update', rules: ['hooks-config-schema'] }
    const result = await api.openIssues({
      findings: [update, commonRule],
      tracked: [common],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(result.opened).toHaveLength(1)
    const sent = JSON.parse(gh.issuePosts()[0]?.input ?? '{}') as { body: string }
    expect(sent.body).toContain(api.markerOf(update))
    expect(sent.body).not.toContain('Inventory rows')
    expect(gh.commentPosts()).toHaveLength(1)
  })

  it('does not read a tracked marker in an open issue as an issue marker', async () => {
    const gh = fakeGh([{ number: 7, body: api.trackedMarkerOf(common) }])
    const result = await api.openIssues({
      findings: [commonRule],
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(result.opened).toHaveLength(1)
  })

  it('shows a diff, a gone block, or no text, and makes docs text inert', () => {
    const diff = api.commentOf(
      [{ tracked: { ...common, oldText: '#### Common fields\n\nOld text.' }, rules: ['a-rule'] }],
      'Hooks',
    )
    expect(diff).toContain('```diff\n  #### Common fields')
    expect(diff).toContain('- Old text.\n+ These fields apply to all hook types.')
    expect(diff).not.toContain('<details>')
    const gone = api.commentOf(
      [
        {
          tracked: { ...common, change: 'removed', newHash: null, newText: null, oldText: 'Old.' },
          rules: ['a-rule'],
        },
      ],
      'Hooks',
    )
    const goneMarker = `<!-- docs-watch-tracked:${HOOKS}#common-fields:gone:${'c'.repeat(64)} -->`
    expect(gone).toContain(goneMarker)
    expect(gone).toContain('The block is gone. Its old text, as quoted data:')
    const empty = api.commentOf(
      [{ tracked: { ...common, newText: null }, rules: ['a-rule'] }],
      'Hooks',
    )
    expect(empty).toContain('No block text is available for this change. See the page.')
    const hostile = api.commentOf(
      [
        {
          tracked: {
            ...common,
            heading: 'Fields @team <!-- x -->',
            newText: '@team\n<!-- docs-watch-tracked:fake -->\n````\nend',
          },
          rules: ['a-rule'],
        },
      ],
      'Hooks',
    )
    expect(hostile).not.toMatch(/@team/)
    expect(hostile.match(/<!--/g)).toHaveLength(1)
    expect(hostile).toContain('`````text')
  })

  it('keeps a long comment under the GitHub limit, cuts it with a note, and keeps every marker', () => {
    const blocks = Array.from({ length: 30 }, (_, i) => ({
      tracked: { ...common, blockId: `b${i}`, newText: '`'.repeat(5000) },
      rules: ['a-rule'],
    }))
    const body = api.commentOf(blocks, 'Hooks')
    expect(body.length).toBeLessThanOrEqual(65_536)
    expect(body.match(/<!-- docs-watch-tracked:/g)).toHaveLength(30)
    expect(body).toContain('Read the page for the rest.')
    expect(api.commentOf(blocks.slice(0, 1), 'Hooks')).not.toContain('Read the page for the rest.')
  })

  it('fails before any gh call for a tracked block that is not valid', async () => {
    const bad: [Record<string, unknown>, string][] = [
      [{ page: '' }, 'has no page'],
      [{ heading: '' }, 'has no heading'],
      [{ blockId: 3 }, 'has no blockId'],
      [{ page: 'http://x' }, 'page that is not an https URL'],
      [{ change: 'moved' }, 'unknown change: moved'],
      [{ oldHash: null, newHash: null }, 'has no hash'],
      [{ oldHash: 'x -->' }, 'oldHash that is not a SHA-256 hash'],
      [{ newHash: 'A'.repeat(64) }, 'newHash that is not a SHA-256 hash'],
      [{ oldText: 3 }, 'oldText that is not text'],
      [{ newText: undefined }, 'newText that is not text'],
      [{ sections: [] }, 'has no sections list'],
      [{ sections: 'Hooks' }, 'has no sections list'],
      [{ sections: [{ section: '', rules: ['a'] }] }, 'a section with no name'],
      [{ sections: [null] }, 'a section with no name'],
      [
        {
          sections: [
            { section: 'Hooks', rules: ['a'] },
            { section: 'Hooks', rules: ['b'] },
          ],
        },
        'a section twice',
      ],
      [{ sections: [{ section: 'Hooks', rules: [] }] }, 'a section with no rules'],
      [{ sections: [{ section: 'Hooks', rules: 'a' }] }, 'a section with no rules'],
      [{ sections: [{ section: 'Hooks', rules: ['a b'] }] }, 'a rule ID that is not valid'],
      [{ sections: [{ section: 'Hooks', rules: ['a', 'a'] }] }, 'or twice'],
    ]
    for (const [fields, message] of bad) {
      const gh = groupGh({ 10: { state: 'open' } })
      await expect(
        api.openIssues({
          findings: [],
          tracked: [{ ...common, ...fields }],
          repo: REPO,
          run: gh.run,
          dryRun: false,
          log: quiet,
        }),
        JSON.stringify(fields),
      ).rejects.toThrow(message)
      expect(gh.calls).toEqual([])
    }
    expect(() => api.validateTracked(null)).toThrow('has no page')
    const gh = groupGh({ 10: { state: 'open' } })
    await expect(live(gh, [common, { ...common }])).rejects.toThrow(
      'a tracked block is in the list twice',
    )
    expect(gh.calls).toEqual([])
    const removed = { ...common, change: 'removed', newHash: null }
    for (const t of [common, removed, { ...common, change: 'added', oldHash: null }]) {
      expect(() => api.validateTracked(t)).not.toThrow()
    }
  })
})

describe('replay of the five tracked hooks blocks (#44, #45, #121, #122, #123)', () => {
  // The old hash, the new hash and the Jev requirement value from each
  // closed issue. The page fixture holds the new text from each issue body.
  const CASES = [
    {
      issue: 44,
      blockId: 'common-fields',
      old: '892963d2890197af43a611978c907486221b02fa3c83962698d46060588af86e',
      new: 'c21a7787217a5b4e5c5074eedfd88f10f1df8e4aede1ab757553356697fca91a',
      requirement: 0.79,
    },
    {
      issue: 45,
      blockId: 'pretooluse-decision-control',
      old: '2abd3fb95446b2de1a36731fc51ff9e2b0635c6da7a67c3898ee295b30e42f29',
      new: 'ed7e5ac643b7d34787c39bbe41f8f9549fafb4decd52952ab9bde1568a04b1ef',
      requirement: 0.58,
    },
    {
      issue: 121,
      blockId: 'command-hook-fields',
      old: '0985903a8f04aa02ef2a3d2297e6dcc762192d9bc7995a5189d4327d4ded2d56',
      new: 'f1f0a8f07e057710409824eaeb2cf815ca7241cb687a8381fd0efe89596057ec',
      requirement: 0.67,
    },
    {
      issue: 122,
      blockId: 'http-hook-fields',
      old: '55f69008271efe7c2b0ae85a002496755d748bf1f3c7fb9d636af62537086385',
      new: 'd8e1e284e3dbb58bf90b86b9ea65f7d6c44dbd9fa43326907502f1c0084d6145',
      requirement: 0.75,
    },
    {
      issue: 123,
      blockId: 'other-exit-codes',
      old: '73247f97fdf080acedc2ef0d6a4989329dbddbe594d5debc91204e69a8425823',
      new: '7c04aec83b59938ad3320736900a52329f1e04cb619a31fce4232c2364c51d43',
      requirement: 0.33,
    },
  ]
  // The rows that cite each block in docs/rules-inventory.md on 2026-10-10.
  const ROWS: Record<string, string[]> = {
    'common-fields': [
      'hooks-config-schema',
      'hooks-handler-field-ignored',
      'hooks-if-condition',
      'hooks-timeout-units',
      'hooks-if-dir-glob-depth',
    ],
    'pretooluse-decision-control': ['hooks-broad-auto-approve', 'hooks-output-deprecated-fields'],
    'command-hook-fields': ['hooks-config-schema', 'hooks-handler-field-ignored'],
    'http-hook-fields': [
      'hooks-config-schema',
      'hooks-http-env-allowlist',
      'hooks-http-literal-secret',
    ],
    'other-exit-codes': ['hooks-script-exists', 'hooks-output-blocking-exit-code'],
  }

  it('tracks each block under Hooks, posts one comment on #10, and opens no issue', async () => {
    const fixture = path.join(import.meta.dirname, 'fixtures/docs-classify/hooks-replay.md')
    const page = readFileSync(fixture, 'utf8')
    const map: SourceMap = { 'hooks-event-name-known': [{ url: HOOKS, heading: 'Hook lifecycle' }] }
    const stored = await watch.readPage(HOOKS, ['Hook lifecycle'], async () => page)
    const newHash = new Map(stored.blocks.map((b) => [b.id, b.hash]))
    for (const c of CASES) expect(newHash.get(c.blockId), `#${c.issue}`).toBe(c.new)
    const before = {
      ...stored,
      hash: '0'.repeat(64),
      blocks: stored.blocks.map((b) => {
        const c = CASES.find((one) => one.blockId === b.id)
        return c ? { id: b.id, hash: c.old } : b
      }),
    }
    const value = new Map(CASES.map((c) => [c.blockId, c.requirement]))
    const fetch: JevFetch = async (_url, init) => {
      const request = JSON.parse(init.body) as { state: { docs_block: { heading: string } } }
      const id = request.state.docs_block.heading.toLowerCase().replaceAll(' ', '-')
      const answers = { requirement: { type: 'noul', noul: value.get(id) ?? 0 } }
      return new Response(JSON.stringify({ model: 'jev-1.13.0', answers }), { status: 200 })
    }
    const output = await classify.classify({
      map,
      inventory: classify.loadInventory(path.join(import.meta.dirname, '..')),
      snapshots: new Map([[watch.snapshotName(HOOKS), before]]),
      rules: new Map(),
      links: new Map(),
      fetchText: async () => page,
      jev: { fetch, key: 'test-key-not-real' },
    })
    expect(output.tracked.map((t) => t.blockId).sort()).toEqual(CASES.map((c) => c.blockId).sort())
    for (const t of output.tracked) {
      const rows = ROWS[t.blockId] ?? ['none']
      expect(t.sections.map((s) => s.section)).toEqual(['Hooks'])
      expect(t.sections[0]?.rules, t.blockId).toEqual(expect.arrayContaining(rows))
      expect(t.oldHash).toBe(CASES.find((c) => c.blockId === t.blockId)?.old)
    }
    // Four new-rule findings, as on the day. #123 is below the 0.4 no value.
    expect(output.findings.map((f) => [f.kind, f.blockId]).sort()).toEqual([
      ['new-rule', 'command-hook-fields'],
      ['new-rule', 'common-fields'],
      ['new-rule', 'http-hook-fields'],
      ['new-rule', 'pretooluse-decision-control'],
    ])
    const gh = groupGh({ 10: { state: 'open' } })
    const result = await api.openIssues({
      findings: output.findings,
      tracked: output.tracked,
      repo: REPO,
      run: gh.run,
      dryRun: false,
      log: quiet,
    })
    expect(gh.issuePosts()).toEqual([])
    expect(gh.commentPosts()).toHaveLength(1)
    const { body } = JSON.parse(gh.commentPosts()[0]?.input ?? '{}') as { body: string }
    for (const c of CASES) {
      expect(body, `#${c.issue}`).toContain(
        `<!-- docs-watch-tracked:${HOOKS}#${c.blockId}:${c.new} -->`,
      )
    }
    expect(body.length).toBeLessThanOrEqual(65_536)
    expect(result.skipped).toBe(4)
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
    const file = findingsFile({ findings: [update], tracked: [] })
    const code = await api.main([file, '--dry-run'], { GITHUB_REPOSITORY: REPO }, gh.run, (t) =>
      logs.push(t),
    )
    expect(code).toBe(0)
    expect(gh.posts()).toEqual([])
    expect(logs.at(-1)).toBe('0 opened, 1 would open, 0 skipped, 0 commented, 0 would comment')
    const other = fakeGh()
    await api.main(['--repo', 'o/r', '--max', '5', file], {}, other.run, quiet)
    expect(other.posts()[0]?.args).toContain('repos/o/r/issues')
  })

  it('exits 1 when it fails, as a script', () => {
    const script = path.join(import.meta.dirname, '../scripts/docs-issues.ts')
    // Node 22.13 to 22.17 needs the flag to run a .ts file.
    const flags = process.features.typescript ? [] : ['--experimental-strip-types']
    const result = spawnSync(process.execPath, [...flags, script], { encoding: 'utf8', env: {} })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('usage')
  })

  it('fails with no file, no repository, a bad --max, no findings list or no tracked list', async () => {
    const gh = fakeGh()
    const file = findingsFile({ findings: [], tracked: [] })
    await expect(api.main([], { GITHUB_REPOSITORY: REPO }, gh.run, quiet)).rejects.toThrow('usage')
    await expect(api.main([file], {}, gh.run, quiet)).rejects.toThrow('set --repo')
    await expect(
      api.main([file, '--max', 'x'], { GITHUB_REPOSITORY: REPO }, gh.run, quiet),
    ).rejects.toThrow('--max takes a whole number')
    await expect(
      api.main([findingsFile({})], { GITHUB_REPOSITORY: REPO }, gh.run, quiet),
    ).rejects.toThrow('has no findings list')
    for (const tracked of [undefined, {}, 'x']) {
      const bad = findingsFile({ findings: [], tracked })
      await expect(api.main([bad], { GITHUB_REPOSITORY: REPO }, gh.run, quiet)).rejects.toThrow(
        'has no tracked list',
      )
    }
    expect(gh.calls).toEqual([])
  })
})
