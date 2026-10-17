// The rule reports frontmatter that the strict `yaml` parser cannot read, in an agent, a skill,
// a command and an output style file. Claude Code can load some of these files (issue #288), so
// the message makes no claim about Claude Code.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Linter } from 'eslint'
import { afterAll, describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import {
  pluginAgent,
  pluginCommand,
  pluginSkill,
  pluginStyle,
} from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const agent = '.claude/agents/a.md'
const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const style = '.claude/output-styles/s.md'
const unclosed = {
  reason: 'Flow sequence in block collection must be sufficiently indented and end with a ]',
  line: '3',
}
const file = (frontmatter: string, filename: string) => ({
  code: `---\n${frontmatter}---\n\nBody.\n`,
  filename,
})

markdownTester.run('frontmatter-yaml-portable', ruleOf('frontmatter-yaml-portable'), {
  valid: [
    // Valid frontmatter, an empty block, comments only and no block, in each kind of file.
    ...[agent, skill, command, style].flatMap((filename) => [
      file('name: s\ndescription: "Use this when x. Context: y"\n', filename),
      { code: '---\n---\n\nBody.\n', filename },
      file('# Owner: web\n', filename),
      { code: '# Notes\n\nBody.\n', filename },
    ]),
    // A value that parses but is not a map is for the rule of each kind.
    file('- name: s\n', skill),
    // A file of no kind that the rule reads.
    ...['docs/agents/a.md', 'docs/SKILL.md', 'commands/c.md', 'docs/output-styles/s.md'].map(
      (filename) => file('foo: [\n', filename),
    ),
  ],
  invalid: [
    // A plain `description` with `: ` in it, as in issue #288.
    {
      ...file('name: reviewer\ndescription: Use this when x. Context: y\n', agent),
      errors: [
        {
          message:
            'This frontmatter is not strict YAML, so other tools cannot read it: Nested mappings are not allowed in compact mappings (line 3).',
          line: 1,
          endLine: 4,
        },
      ],
    },
    // A flow sequence with no `]`, in each kind of file.
    ...[skill, command, style, agent].map((filename) => ({
      ...file('name: s\nfoo: [\n', filename),
      errors: [{ messageId: 'notPortable', data: unclosed }],
    })),
    // `claude plugin validate` does not report this YAML in a plugin either.
    ...[pluginAgent(), pluginSkill(), pluginCommand(), pluginStyle()].map((filename) => ({
      ...file('name: s\nfoo: [\n', filename),
      errors: [{ messageId: 'notPortable', data: unclosed }],
    })),
    // The parser gives no line for an alias with no anchor.
    {
      ...file('name: s\nfoo: *x\n', skill),
      errors: [
        {
          message:
            'This frontmatter is not strict YAML, so other tools cannot read it: Unresolved alias (the anchor must be set before the alias): x.',
        },
      ],
    },
    // The hint of issue #273: YAML reads `[n]` as a list, and a second `[n]` after it is an error.
    {
      ...file('name: s\nargument-hint: [n] [n]\n', skill),
      errors: [
        {
          messageId: 'notPortable',
          data: { reason: 'Unexpected flow-seq-start at node end', line: '3' },
        },
      ],
    },
  ],
})

// A parse error gets one report in `recommended`: this rule warns, and the rule of each kind is
// silent. The scratch directory holds no other file, so no rule that reads the disk reports.
describe('frontmatter-yaml-portable in recommended', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'frontmatter-yaml-portable-'))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))
  const lint = (code: string, filename: string) =>
    new Linter({ cwd: scratch })
      .verify(code, plugin.configs.recommended, { filename: path.join(scratch, filename) })
      .map((m) => `${m.ruleId}@${m.severity}`)

  const portable = 'claude/frontmatter-yaml-portable@1'
  it.each([
    ['name: reviewer\ndescription: Use this when x. Context: y\n', agent, [portable]],
    ['name: s\ndescription: d\nargument-hint: [n] [n]\n', skill, [portable]],
    // `command-legacy-format` reports each command file.
    ['description: d\nfoo: [\n', command, ['claude/command-legacy-format@1', portable]],
    ['name: s\nfoo: [\n', style, [portable]],
  ])('gives one report on %j in %s', (frontmatter, filename, expected) => {
    expect(lint(`---\n${frontmatter}---\n\nBody.\n`, filename)).toEqual(expected)
  })
})
