// The classifier reads each `autoMode` entry as prose. It is not a tool pattern. A rule such as
// `Bash(git push *)` belongs in `permissions`
// (https://code.claude.com/docs/en/auto-mode-config#define-trusted-infrastructure and
// https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules). The
// classifier reads `autoMode` from managed settings, and not from the two project files, so the
// rule reads managed files. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-rule-syntax'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'

const lint = (code: unknown, file = MANAGED) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = MANAGED) => lint(code, file).map((message) => message.messageId)
const mode = (autoMode: object) => ({ autoMode })

describe(`${name}: reports`, () => {
  it.fails('reports an entry shaped like a permission rule, in each list', () => {
    for (const list of ['environment', 'allow', 'soft_deny', 'hard_deny']) {
      const messages = lint(mode({ [list]: ['$defaults', 'Bash(git push *)'] }))
      expect(messages, list).toHaveLength(1)
      expect(messages[0]).toMatchObject({ messageId: 'ruleShaped', line: 1 })
      expect(messages[0]?.message).toContain('`Bash(git push *)`')
      expect(messages[0]?.message).toContain(`autoMode.${list}`)
      expect(messages[0]?.message).toContain('permissions')
    }
  })

  it.fails('reports in a managed file and in a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(mode({ allow: ['Bash(ls)'] }), file), file).toEqual(['ruleShaped'])
    }
  })

  it.fails('reports each tool name of the docs, an MCP rule and a legacy name', () => {
    const entries = [
      'Read(./.env)',
      'Edit(src/**)',
      'WebFetch(domain:example.com)',
      'PowerShell(Get-ChildItem *)',
      'Agent(Explore)',
      'mcp__github__create_issue(x)',
      'Task(Explore)',
      'Cd(/tmp)',
    ]
    expect(ids(mode({ soft_deny: entries }))).toEqual(entries.map(() => 'ruleShaped'))
  })

  it.fails('reports an entry with white space around it, at the entry', () => {
    const messages = lint('{\n"autoMode": {"allow": [\n"  Bash(ls)  "]}}')
    expect(messages.map((message) => message.line)).toEqual([3])
  })

  it.fails('reports each entry', () => {
    expect(ids(mode({ allow: ['Bash(ls)', 'Bash(pwd)'], hard_deny: ['Read(./.env)'] }))).toEqual([
      'ruleShaped',
      'ruleShaped',
      'ruleShaped',
    ])
  })
})

describe(`${name}: silent`, () => {
  it.fails('stays silent for prose, the default marker and the entries of the docs examples', () => {
    const entries = [
      '$defaults',
      'Source control: github.example.com/acme-corp and all repos under it',
      'Deploying to the staging namespace is allowed: staging is isolated from production and resets nightly',
      'Never modify files under infra/terraform/prod/: production infrastructure changes go through the review workflow',
      'Never send repository contents to third-party code-review APIs',
    ]
    expect(
      ids(mode({ environment: entries.slice(0, 2), allow: entries, soft_deny: entries })),
    ).toEqual([])
  })

  it.fails('stays silent for prose that holds a call in parentheses', () => {
    const entries = [
      'Git Destructive [named+specifics]: Force pushing (`git push --force`), deleting remote branches',
      'Never run Bash(rm -rf) on a shared host',
      'Bash(ls) is fine in a sandbox',
      'Run Bash(ls)',
      'Bash (ls)',
      'Bash(ls',
      'Foo(bar)',
      'bash(ls)',
      '(ls)',
      'Bash',
      'mcp__(x)',
      '',
    ]
    expect(ids(mode({ allow: entries }))).toEqual([])
  })

  it.fails('stays silent for values that are not lists of strings', () => {
    expect(ids(mode({ allow: 'Bash(ls)' }))).toEqual([])
    expect(ids(mode({ allow: [7, null, { a: 'Bash(ls)' }] }))).toEqual([])
    expect(ids(mode({ classifyAllShell: true, extra: ['Bash(ls)'] }))).toEqual([])
    expect(ids({ autoMode: null })).toEqual([])
    expect(ids({ autoMode: ['Bash(ls)'] })).toEqual([])
    expect(ids({ permissions: { allow: ['Bash(ls)'] } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it.fails('stays silent in a hidden drop-in, and in a project or local file', () => {
    const code = mode({ allow: ['Bash(ls)'] })
    expect(ids(code, HIDDEN)).toEqual([])
    expect(ids(code, PROJECT)).toEqual([])
    expect(ids(code, LOCAL)).toEqual([])
  })
})
