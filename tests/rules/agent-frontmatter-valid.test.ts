// The rule checks local agents only. The docs say a plugin agent with no name
// or bad YAML still loads, so the rule stays silent there.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (frontmatter: string, filename = local) => ({
  code: `---\n${frontmatter}---\n\nYou review code.\n`,
  filename,
})

markdownTester.run('agent-frontmatter-valid', ruleOf('agent-frontmatter-valid'), {
  valid: [
    file('name: reviewer\ndescription: Reviews code.\n'),
    file('name: reviewer-v2\ndescription: Reviews code.\n', '.claude/agents/review/b.md'),
    // A `-` inside a name, and a name that is not a string, are not this rule's fault.
    file('name: code-reviewer\ndescription: Reviews code.\n'),
    file('name: 123\ndescription: 456\n'),
    // A file with no frontmatter is documentation kept beside the agents.
    { code: '# Agents\n\nNotes.\n', filename: '.claude/agents/README.md' },
    // A horizontal rule is not a frontmatter block.
    { code: '# Agents\n\n---\n\nNotes.\n\n---\n', filename: '.claude/agents/README.md' },
    // A block in a code fence is an example, not frontmatter.
    {
      code: '# Agents\n\n```yaml\n---\nname: x\ndescription: d\n---\n```\n',
      filename: local,
    },
    // A late block with no agent field is a table or a note.
    { code: '# Notes\n\n---\nowner: web\n---\n', filename: local },
    // A plugin agent with the same faults loads anyway.
    file('description: No name.\n', pluginAgent()),
    file('name: [unclosed\n', pluginAgent()),
    file('name: "-x:y"\n', pluginAgent()),
    // Not an agent file.
    file('name: [unclosed\n', 'docs/agents/a.md'),
    file('name: [unclosed\n', '.claude/skills/agents.md'),
    file('name: [unclosed\n', '.claude/other/a.md'),
  ],
  invalid: [
    {
      ...file('description: Reviews code.\n'),
      errors: [{ messageId: 'missingName', line: 1, endLine: 3 }],
    },
    {
      ...file('name:\ndescription: Reviews code.\n'),
      errors: [{ messageId: 'missingName' }],
    },
    {
      ...file('name: "  "\ndescription: Reviews code.\n'),
      errors: [{ messageId: 'missingName' }],
    },
    {
      ...file('name: reviewer\n'),
      errors: [{ messageId: 'missingDescription' }],
    },
    {
      ...file('name: reviewer\ndescription:\n'),
      errors: [{ messageId: 'missingDescription' }],
    },
    {
      ...file('model: sonnet\n'),
      errors: [{ messageId: 'missingName' }, { messageId: 'missingDescription' }],
    },
    // An empty block has no field.
    {
      code: '---\n---\n\nBody.\n',
      filename: local,
      errors: [{ messageId: 'missingName' }, { messageId: 'missingDescription' }],
    },
    {
      ...file('name: -reviewer\ndescription: Reviews code.\n'),
      errors: [{ messageId: 'badName', line: 2, column: 7, endColumn: 16 }],
    },
    {
      ...file('name: "my-plugin:reviewer"\ndescription: Reviews code.\n'),
      errors: [{ messageId: 'badName', line: 2 }],
    },
    {
      ...file('name: [unclosed\ndescription: d\n'),
      errors: [{ messageId: 'invalidYaml' }],
    },
    // The top level of the YAML is not a map.
    {
      ...file('just text\n'),
      errors: [{ messageId: 'invalidYaml' }],
    },
    // A whitespace-only block is an empty block.
    {
      code: '---\n  \n\n---\n\nBody.\n',
      filename: local,
      errors: [{ messageId: 'missingName' }, { messageId: 'missingDescription' }],
    },
    // The deepest `agents/` directory that fits is local, when an outer one is not.
    {
      ...file('description: d\n', '.claude/agents/team/agents/x.md'),
      errors: [{ messageId: 'missingName' }],
    },
    // A horizontal rule above the block does not hide it.
    {
      code: '# Agents\n\n---\n\nText\n\n---\nname: x\ndescription: d\n---\n',
      filename: local,
      errors: [{ messageId: 'notFirst', line: 7 }],
    },
    // The opening marker is not line 1.
    {
      code: '\n---\nname: reviewer\ndescription: Reviews code.\n---\n\nBody.\n',
      filename: local,
      errors: [{ messageId: 'notFirst', line: 2, column: 1, endColumn: 4 }],
    },
    {
      code: '# Reviewer\n\n---\nname: reviewer\ndescription: Reviews code.\n---\n',
      filename: '.claude/agents/review/b.md',
      errors: [{ messageId: 'notFirst', line: 3 }],
    },
  ],
})

// A plugin root that the rule cannot see is not a local agent directory. The rule does not use
// the `.claude/agents/` above it.
describe.skipIf(chmodCannotBlock)('a plugin root that the rule cannot see', () => {
  it('makes no report for a plugin agent in `.claude/agents/`', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'agent-frontmatter-valid-'))
    try {
      const meta = path.join(scratch, '.claude', 'agents', 'plug', '.claude-plugin')
      mkdirSync(meta, { recursive: true })
      writeFileSync(path.join(meta, 'plugin.json'), '{}')
      const agent = path.join(scratch, '.claude', 'agents', 'plug', 'agents', 'a.md')
      const lint = () => lintMarkdown('agent-frontmatter-valid', '---\nname: x\n---\n', agent)
      expect(lint()).toEqual([])
      withoutAccess(meta, () => expect(lint()).toEqual([]))
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})

// Claude Code skips a local agent file whose `name` has more than 256 characters. The option
// `nameMax` sets a lower limit.
const lintName = (agentName: string, filename: string, options: object[] = []) =>
  new Linter({ cwd: path.parse(path.resolve(filename)).root }).verify(
    `---\nname: ${agentName}\ndescription: Reviews code.\n---\n`,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, claude: plugin },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { 'claude/agent-frontmatter-valid': ['error', ...options] },
      },
    ],
    { filename: path.resolve(filename) },
  )

describe('a name of more than 256 characters', () => {
  it('is silent at 256 characters, and reports at 257', () => {
    expect(lintName('a'.repeat(256), local)).toEqual([])
    const [report, ...rest] = lintName('a'.repeat(257), local)
    expect(rest).toEqual([])
    expect(report?.messageId).toBe('nameTooLong')
    expect(report?.message).toBe(
      '`name` has 257 characters. Claude Code skips an agent file with a `name` of more than 256.',
    )
    expect([report?.line, report?.column, report?.endColumn]).toEqual([2, 7, 264])
  })
  it('counts a character outside the BMP once', () => {
    expect(lintName('\u{1F600}'.repeat(200), local, [{ nameMax: 100 }])).toHaveLength(1)
    expect(lintName('\u{1F600}'.repeat(200), local)).toEqual([])
  })
  it('moves with the option, and names the configured limit', () => {
    expect(lintName('abcdef', local, [{ nameMax: 6 }])).toEqual([])
    const [report, ...rest] = lintName('abcdefg', local, [{ nameMax: 6 }])
    expect(rest).toEqual([])
    expect(report?.messageId).toBe('nameOverConfiguredLimit')
    expect(report?.message).toBe('`name` has 7 characters. The configured limit is 6.')
  })
  it('refuses an option above 256', () => {
    expect(() => lintName('a', local, [{ nameMax: 256 }])).not.toThrow()
    expect(() => lintName('a', local, [{ nameMax: 257 }])).toThrow('Value 257 should be <= 256.')
  })
  it('refuses an option of 0, of 6.5, or with an unknown key', () => {
    expect(() => lintName('a', local, [{ nameMax: 0 }])).toThrow()
    expect(() => lintName('a', local, [{ nameMax: 6.5 }])).toThrow()
    expect(() => lintName('a', local, [{ other: 1 }])).toThrow()
  })
  it('reports a bad name and a long name as two faults', () => {
    const reports = lintName(`-${'a'.repeat(256)}`, local)
    expect(reports.map((report) => report.messageId).toSorted()).toEqual(['badName', 'nameTooLong'])
  })
  it('is silent for a plugin agent', () => {
    expect(lintName('a'.repeat(300), pluginAgent())).toEqual([])
  })
})
