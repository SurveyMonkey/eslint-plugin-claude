// The rule checks local agents only. The docs say a plugin agent with no name
// or bad YAML still loads, so the rule stays silent there.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
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
