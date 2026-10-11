// Inside the classifier, an `allow` entry is an exception to a `soft_deny` entry, so a developer
// entry can override an organization `soft_deny` entry. The combination is not a hard policy
// boundary. `hard_deny` and `permissions.deny` are
// (https://code.claude.com/docs/en/auto-mode-config#where-the-classifier-reads-configuration and
// https://code.claude.com/docs/en/auto-mode-config#override-the-block-and-allow-rules). The
// classifier reads `autoMode` from managed settings, and not from the two project files. The files
// glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-auto-mode-allow-overrides'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT = '/repo/.claude/settings.json'

const lint = (code: unknown, file = MANAGED) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = MANAGED) => lint(code, file).map((message) => message.messageId)
const softDeny = (...entries: string[]) => ({ autoMode: { soft_deny: entries } })

describe(`${name}: reports`, () => {
  it.fails('reports a soft_deny entry that states a rule without exception, at the entry', () => {
    const messages = lint(
      '{\n"autoMode": {"soft_deny": [\n"$defaults",\n"Never push to the release branch"]}}',
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'overridable', line: 4 })
    expect(messages[0]?.message).toContain('"Never push to the release branch"')
    expect(messages[0]?.message).toContain('hard_deny')
    expect(messages[0]?.message).toContain('permissions.deny')
  })

  it.fails('reports in a managed file and in a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(softDeny('Never touch prod'), file), file).toEqual(['overridable'])
    }
  })

  it.fails('reports each wording of a rule without exception, in any letter case', () => {
    const entries = [
      'NEVER deploy on Friday',
      'Claude must never read the vault',
      'Claude must not edit the lock file',
      'Do this under no circumstances: delete backups',
      'No exceptions: do not delete the backups',
    ]
    expect(ids(softDeny(...entries))).toEqual(entries.map(() => 'overridable'))
  })

  it.fails('reports each such entry', () => {
    expect(ids(softDeny('Never a', '$defaults', 'Never b', 'Prefer c'))).toEqual([
      'overridable',
      'overridable',
    ])
  })
})

describe(`${name}: silent`, () => {
  it.fails('stays silent for a soft_deny entry that states no rule without exception', () => {
    expect(
      ids(
        softDeny(
          '$defaults',
          'Avoid migrations outside the CLI',
          'Deploys to prod need review',
          'Nevertheless, ask first',
        ),
      ),
    ).toEqual([])
  })

  it.fails('stays silent for the words in the other lists', () => {
    const entry = ['Never push to the release branch']
    const code = { autoMode: { allow: entry, hard_deny: entry, environment: entry } }
    expect(ids(code)).toEqual([])
  })

  it.fails('stays silent for values that are not lists of strings', () => {
    expect(ids({ autoMode: { soft_deny: 'Never x' } })).toEqual([])
    expect(ids(softDeny())).toEqual([])
    expect(ids({ autoMode: { soft_deny: [7, null, ['Never x']] } })).toEqual([])
    expect(ids({ autoMode: null })).toEqual([])
    expect(ids({ autoMode: ['Never x'] })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it.fails('stays silent in a hidden drop-in, and in a project file', () => {
    expect(ids(softDeny('Never x'), HIDDEN)).toEqual([])
    expect(ids(softDeny('Never x'), PROJECT)).toEqual([])
  })
})
