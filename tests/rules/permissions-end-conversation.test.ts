// A deny or ask rule that names `EndConversation` has no effect while any other tool remains:
// https://code.claude.com/docs/en/tools-reference#endconversation-tool-behavior
// https://code.claude.com/docs/en/permissions#manage-permissions
// https://code.claude.com/docs/en/settings-reference#permissions-deny
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-end-conversation'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)

describe(`${name}: the reports`, () => {
  it('reports a deny rule in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids({ permissions: { deny: ['EndConversation'] } }, file), file).toEqual(['noEffect'])
    }
  })

  it('reports an ask rule', () => {
    expect(ids({ permissions: { ask: ['EndConversation'] } })).toEqual(['noEffect'])
  })

  it('reports each entry once, in deny and in ask', () => {
    expect(
      ids({
        permissions: { deny: ['Bash(rm *)', 'EndConversation'], ask: ['EndConversation', 'Read'] },
      }),
    ).toEqual(['noEffect', 'noEffect'])
  })

  it('says which list, and that the rule has no effect while another tool remains', () => {
    const [deny] = lint({ permissions: { deny: ['EndConversation'] } })
    expect(deny?.message).toContain('A rule in `deny` that names')
    expect(deny?.message).toContain('no effect while any other tool remains')
    const [ask] = lint({ permissions: { ask: ['EndConversation'] } })
    expect(ask?.message).toContain('A rule in `ask` that names')
  })

  it('reports the entry, at its line, column and end', () => {
    const [message] = lint('{"permissions":{"deny":["EndConversation"]}}')
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 25, 1, 42,
    ])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent in allow, where the docs use the name to keep the tool', () => {
    expect(ids({ permissions: { allow: ['EndConversation'] } })).toEqual([])
  })

  it('is silent for a glob, which removes the tool when no other tool remains', () => {
    expect(ids({ permissions: { deny: ['*', 'End*'], ask: ['*'] } })).toEqual([])
  })

  it('is silent for a rule with a specifier: permissions-specifier-unsupported reports it', () => {
    expect(ids({ permissions: { deny: ['EndConversation(*)', 'EndConversation(x)'] } })).toEqual([])
  })

  it('is silent for another tool, and for a name that is spelled otherwise', () => {
    expect(
      ids({ permissions: { deny: ['Endconversation', 'EndConversations', 'Bash', 'Agent'] } }),
    ).toEqual([])
  })

  it('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids({ permissions: { deny: ['EndConversation('] } })).toEqual([])
  })

  it('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { deny: [3, null] } })).toEqual([])
    expect(ids({ permissions: { ask: 'EndConversation' } })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids({ permissions: { deny: ['EndConversation'] } }, HIDDEN)).toEqual([])
  })

  it('is silent for an empty specifier and for a name with a prefix', () => {
    expect(
      ids({ permissions: { deny: ['EndConversation()', 'mcp__x__EndConversation'] } }),
    ).toEqual([])
  })
})
