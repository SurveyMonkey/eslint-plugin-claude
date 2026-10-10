// An `allow` rule that a `deny` or `ask` rule covers never applies: Claude Code checks deny, then
// ask, then allow, and specificity does not change the order:
// https://code.claude.com/docs/en/permissions#manage-permissions
// The rule adds up the lists of one source: the project pair, or one managed source.
// The tests of a source use files on disk.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-dead-allow'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/10-a.json'

const perms = (fields: Record<string, string[]>) => JSON.stringify({ permissions: fields })
/** The message ids for `text` at `file` of the repository `root`. */
const at = (root: string, file: string, text: string) =>
  lintJson(name, text, path.join(root, file)).map((message) => message.messageId)
const alone = (text: string, file = PROJECT) => at(repo({}), file, text)

describe(`${name}: one file`, () => {
  it('reports an allow rule under a bare deny of the tool', () => {
    for (const deny of ['Bash', 'Bash(*)']) {
      expect(alone(perms({ allow: ['Bash(npm test)'], deny: [deny] })), deny).toEqual(['dead'])
    }
    expect(alone(perms({ allow: ['Bash'], deny: ['Bash'] }))).toEqual(['dead'])
  })

  it('reports an allow rule under a bare ask of the tool, and names the list', () => {
    const [message] = lintJson(
      name,
      perms({ allow: ['Read(./a)'], ask: ['Read'] }),
      '/repo/.claude/settings.json',
    )
    expect(message?.messageId).toBe('dead')
    expect(message?.message).toContain('ask')
    expect(message?.message).toContain('Read')
  })

  it('reports at the allow entry, at its line and column', () => {
    const text =
      '{\n  "permissions": {\n    "allow": ["Bash(npm test)"],\n    "deny": ["Bash"]\n  }\n}'
    const [message] = lintJson(name, text, '/repo/.claude/settings.json')
    expect([message?.line, message?.column]).toEqual([3, 15])
  })

  it('is silent when the deny rule is narrower than the allow rule', () => {
    expect(alone(perms({ allow: ['Bash(npm test)'], deny: ['Bash(rm *)'] }))).toEqual([])
    expect(alone(perms({ allow: ['Bash'], deny: ['Bash(rm *)'] }))).toEqual([])
    expect(alone(perms({ allow: ['Bash(npm *)'], deny: ['Bash(npm run *)'] }))).toEqual([])
  })

  it('is silent for another tool', () => {
    expect(alone(perms({ allow: ['Read'], deny: ['Bash'] }))).toEqual([])
  })

  it('reports an allow rule that a command pattern covers', () => {
    const cases: [string, string][] = [
      ['Bash(npm test)', 'Bash(npm *)'],
      ['Bash(npm run *)', 'Bash(npm *)'],
      ['Bash(npm)', 'Bash(npm *)'],
      ['Bash(npm test)', 'Bash(npm:*)'],
      ['Bash(npm test)', 'Bash(npm test)'],
      ['Bash(npm   test)', 'Bash(npm test)'],
      ['PowerShell(Get-Item x)', 'PowerShell(Get-*)'],
      ['Bash(git push)', 'Bash(*)'],
    ]
    for (const [allow, deny] of cases) {
      expect(alone(perms({ allow: [allow], deny: [deny] })), `${allow} ${deny}`).toEqual(['dead'])
    }
  })

  it('is silent when a command pattern does not cover the allow rule', () => {
    const cases: [string, string][] = [
      ['Bash(npm *)', 'Bash(npm test)'],
      ['Bash(lsof)', 'Bash(ls *)'],
      ['Bash(git log main)', 'Bash(git log * main)'],
      ['Bash', 'Bash(npm *)'],
    ]
    for (const [allow, deny] of cases) {
      expect(alone(perms({ allow: [allow], deny: [deny] })), `${allow} ${deny}`).toEqual([])
    }
  })

  it('reads an exact match only for a tool that is not a command tool', () => {
    expect(alone(perms({ allow: ['Read(./a)'], deny: ['Read(./a)'] }))).toEqual(['dead'])
    expect(alone(perms({ allow: ['Read(./a)'], deny: ['Read(./*)'] }))).toEqual([])
    expect(alone(perms({ allow: ['Read(./a)'], deny: ['Read(*)'] }))).toEqual([])
    expect(alone(perms({ allow: ['Read'], deny: ['Read(./a)'] }))).toEqual([])
  })

  it('is silent for a rule that does not parse, and for a list that is not an array', () => {
    expect(alone(perms({ allow: ['Bash('], deny: ['Bash'] }))).toEqual([])
    expect(alone(JSON.stringify({ permissions: { allow: 'Bash', deny: ['Bash'] } }))).toEqual([])
    expect(alone('{}')).toEqual([])
  })

  it('reports in a managed file and a drop-in', () => {
    const text = perms({ allow: ['Bash(npm test)'], deny: ['Bash'] })
    expect(alone(text, MANAGED)).toEqual(['dead'])
    expect(alone(text, DROP_IN)).toEqual(['dead'])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    const text = perms({ allow: ['Bash(npm test)'], deny: ['Bash'] })
    expect(alone(text, 'managed-settings.d/.10-a.json')).toEqual([])
  })
})

describe(`${name}: the rule that is named`, () => {
  it('names the deny rule when a deny rule and an ask rule both cover the allow rule', () => {
    for (const permissions of [
      { allow: ['Bash(x)'], ask: ['Bash'], deny: ['Bash(x)'] },
      { allow: ['Bash(x)'], deny: ['Bash(x)'], ask: ['Bash'] },
    ]) {
      const [message] = lintJson(
        name,
        JSON.stringify({ permissions }),
        '/repo/.claude/settings.json',
      )
      expect(message?.message).toContain('deny rule')
    }
  })
})

describe(`${name}: the project pair, on disk`, () => {
  const ALLOW = perms({ allow: ['Bash(npm test)'] })
  const DENY = perms({ deny: ['Bash'] })

  it('names an ask rule of the other file as the cover', () => {
    const root = repo({ [LOCAL]: perms({ ask: ['Bash'] }) })
    const [message] = lintJson(name, ALLOW, path.join(root, PROJECT))
    expect(message?.message).toContain('The ask rule `Bash`')
  })

  it('adds up the deny rules of the other file, whichever file holds the allow rule', () => {
    const root = repo({ [PROJECT]: ALLOW, [LOCAL]: DENY })
    expect(at(root, PROJECT, ALLOW)).toEqual(['dead'])
    expect(at(root, LOCAL, DENY)).toEqual([])
    const swapped = repo({ [PROJECT]: DENY, [LOCAL]: ALLOW })
    expect(at(swapped, LOCAL, ALLOW)).toEqual(['dead'])
  })

  it('is silent when the other file has a narrower deny rule', () => {
    const root = repo({ [LOCAL]: perms({ deny: ['Bash(rm *)'] }) })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
  })

  it('does not read a managed file for a project file', () => {
    const root = repo({ [MANAGED]: DENY, '.claude/managed-settings.json': DENY })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
  })

  it('adds nothing for a sibling that does not read', () => {
    const root = repo({ [LOCAL]: '[1]' })
    expect(at(root, PROJECT, ALLOW)).toEqual([])
    expect(at(root, PROJECT, perms({ allow: ['Bash'], deny: ['Bash'] }))).toEqual(['dead'])
  })

  it('reads a root that is not an object as a file without rules', () => {
    expect(alone('[1]')).toEqual([])
  })
})

describe(`${name}: a managed source, on disk`, () => {
  const ALLOW = perms({ allow: ['Bash(npm test)'] })
  const DENY = perms({ deny: ['Bash'] })

  it('adds up the deny rules of the other files of the source', () => {
    const root = repo({ [MANAGED]: DENY, [DROP_IN]: ALLOW })
    expect(at(root, DROP_IN, ALLOW)).toEqual(['dead'])
    const main = repo({ [MANAGED]: ALLOW, 'managed-settings.d/20-b.json': DENY })
    expect(at(main, MANAGED, ALLOW)).toEqual(['dead'])
  })

  it('does not read a project file for a managed file', () => {
    const root = repo({ [PROJECT]: DENY, [LOCAL]: DENY })
    expect(at(root, MANAGED, ALLOW)).toEqual([])
  })

  it('ignores a hidden sibling', () => {
    const root = repo({ 'managed-settings.d/.20-b.json': DENY })
    expect(at(root, DROP_IN, ALLOW)).toEqual([])
  })

  it('adds nothing for a sibling that does not read', () => {
    const root = repo({ 'managed-settings.d/20-b.json': '[1]' })
    expect(at(root, DROP_IN, ALLOW)).toEqual([])
  })

  it('adds nothing for a drop-in directory that is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    const outside = repo({ 'managed-settings.d/20-b.json': DENY })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(at(root, MANAGED, perms({ allow: ['Bash'], deny: ['Bash'] }))).toEqual(['dead'])
    expect(at(root, MANAGED, ALLOW)).toEqual([])
  })
})

describe(`${name}: the entries of a sibling that are no rule`, () => {
  it('reads a sibling entry that is not a string or does not parse as no rule', () => {
    const root = repo({ [LOCAL]: JSON.stringify({ permissions: { deny: [1, 'Bash(', 'Edit'] } }) })
    expect(at(root, PROJECT, perms({ allow: ['Bash(npm test)'] }))).toEqual([])
    expect(at(root, PROJECT, perms({ allow: ['Edit(./a)'] }))).toEqual(['dead'])
  })

  it('reads a sibling list that is not an array as no rule', () => {
    const root = repo({ [LOCAL]: JSON.stringify({ permissions: { deny: 'Bash' } }) })
    expect(at(root, PROJECT, perms({ allow: ['Bash(npm test)'] }))).toEqual([])
  })
})
