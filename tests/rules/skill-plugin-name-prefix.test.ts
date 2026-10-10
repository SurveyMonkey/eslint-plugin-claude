// A plugin skill whose `name` starts with the plugin prefix. Claude Code from v2.1.216 through
// v2.1.245 adds the prefix again. The rule is inactive until the option `minVersion` is set. The
// plugin name comes from the manifest on disk, so each case writes a tree to a temporary
// directory.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-name-prefix-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

// A plugin that names itself, one that does not, and one with a manifest that does not parse.
put('plug/.claude-plugin/plugin.json', '{"name": "my-plugin"}')
put('bare/.claude-plugin/plugin.json', '{}')
put('broken/.claude-plugin/plugin.json', '{')
const skill = put('plug/skills/s/SKILL.md', '')
const rootSkill = put('plug/SKILL.md', '')
const bareSkill = put('bare/skills/s/SKILL.md', '')
const brokenSkill = put('broken/skills/s/SKILL.md', '')
const command = put('plug/commands/c.md', '')
// A file with this name below `commands/` is a command file, not a skill.
const commandNamedSkill = put('plug/commands/SKILL.md', '')
const project = put('proj/.claude/skills/s/SKILL.md', '')
const decoy = put('plug/docs/SKILL.md', '')

const named = (value: string) => `---\nname: ${value}\ndescription: d\n---\n\n# S\n`
// A repository that supports a version inside the range of the fault.
const BEFORE_FIX = [{ minVersion: '2.1.230' }]

const error = (extra: object = {}) => ({ messageId: 'doubled' as const, ...extra })

markdownTester.run('skill-plugin-name-prefix', ruleOf('skill-plugin-name-prefix'), {
  valid: [
    { code: named('fancy'), filename: skill, options: BEFORE_FIX },
    // The prefix is the plugin name, so another prefix is a name of its own.
    { code: named('other:fancy'), filename: skill, options: BEFORE_FIX },
    { code: named('my-plugin-x:fancy'), filename: skill, options: BEFORE_FIX },
    { code: named('my-plugin'), filename: skill, options: BEFORE_FIX },
    // With no `minVersion`, the rule is inactive.
    { code: named('my-plugin:fancy'), filename: skill },
    { code: named('my-plugin:fancy'), filename: skill, options: [{}] },
    // A repository that needs v2.1.246 or later never sees the doubled prefix.
    { code: named('my-plugin:fancy'), filename: skill, options: [{ minVersion: '2.1.246' }] },
    { code: named('my-plugin:fancy'), filename: skill, options: [{ minVersion: '2.2.0' }] },
    // The `name` field is not a name.
    { code: '---\nname: 5\n---\n', filename: skill, options: BEFORE_FIX },
    { code: '---\nname: [my-plugin:x]\n---\n', filename: skill, options: BEFORE_FIX },
    { code: '---\ndescription: d\n---\n', filename: skill, options: BEFORE_FIX },
    { code: '---\n---\n', filename: skill, options: BEFORE_FIX },
    { code: '# S\n', filename: skill, options: BEFORE_FIX },
    // YAML that does not parse is a fault of another rule.
    { code: '---\nname: [my-plugin:x\n---\n', filename: skill, options: BEFORE_FIX },
    // A project skill has no plugin prefix.
    { code: named('my-plugin:fancy'), filename: project, options: BEFORE_FIX },
    // The name of the scope directory is no prefix.
    { code: named('.claude:fancy'), filename: project, options: BEFORE_FIX },
    // Claude Code does not read the `name` of a command file.
    { code: named('my-plugin:fancy'), filename: command, options: BEFORE_FIX },
    { code: named('my-plugin:fancy'), filename: commandNamedSkill, options: BEFORE_FIX },
    // A manifest that the rule cannot read can hold any name.
    { code: named('broken:fancy'), filename: brokenSkill, options: BEFORE_FIX },
    // Not a skill file.
    { code: named('my-plugin:fancy'), filename: decoy, options: BEFORE_FIX },
  ],
  invalid: [
    {
      code: named('my-plugin:fancy'),
      filename: skill,
      options: BEFORE_FIX,
      errors: [error({ line: 2, column: 7, endLine: 2, endColumn: 22 })],
    },
    // The plugin-root skill has the same prefix.
    { code: named('my-plugin:fancy'), filename: rootSkill, options: BEFORE_FIX, errors: [error()] },
    // A manifest with no `name` gives the plugin directory name.
    { code: named('bare:fancy'), filename: bareSkill, options: BEFORE_FIX, errors: [error()] },
    // The range of the fault is 2.1.216 through 2.1.245, and the option is the oldest version.
    ...['2.1.216', '2.1.245', '2.1.0', '2.0.0'].map((minVersion) => ({
      code: named('my-plugin:fancy'),
      filename: skill,
      options: [{ minVersion }],
      errors: [error()],
    })),
  ],
})

describe('the message', () => {
  it('names the name, the prefix and the fix', () => {
    const [message] = lintMarkdown(
      'skill-plugin-name-prefix',
      named('my-plugin:fancy'),
      skill,
      BEFORE_FIX,
    )
    expect(message?.message).toBe(
      '`my-plugin:fancy` starts with the plugin prefix `my-plugin:`. Claude Code from v2.1.216 through v2.1.245 adds the prefix again. Remove the prefix, or set the option `minVersion` to 2.1.246 or later.',
    )
  })
})

describe('the option', () => {
  const lint = (option: unknown) =>
    lintMarkdown('skill-plugin-name-prefix', named('my-plugin:x'), skill, [option])

  it.each([{ minversion: '2.1.0' }, { minVersion: 2 }, { other: true }])('refuses %j', (option) => {
    expect(() => lint(option)).toThrow('Key "claude/skill-plugin-name-prefix"')
  })

  it.each(['2.1', 'v2.1.230', '2.1.x', ''])('refuses the minVersion %j', (minVersion) => {
    expect(() => lint({ minVersion })).toThrow('Key "claude/skill-plugin-name-prefix"')
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
    put('repo/real/.claude-plugin/plugin.json', '{"name": "real"}')
    put('outside/.claude-plugin/plugin.json', '{"name": "plug"}')
    put('repo/real/skills/s/SKILL.md', '')
    symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
    const lint = (file: string, name: string) =>
      lintMarkdown('skill-plugin-name-prefix', named(name), file, BEFORE_FIX)
    expect(lint(path.join(scratch, 'repo/plug/SKILL.md'), 'plug:x')).toEqual([])
    expect(lint(path.join(scratch, 'repo/real/skills/s/SKILL.md'), 'real:x')).toHaveLength(1)
  })
})
