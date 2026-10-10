// The sub-agents page marks `omitClaudeMd` (v2.1.271) and
// `experimental.cacheTtl` (v2.1.248) with the version that adds them. The
// changelog adds the `manual` alias of `permissionMode` in v2.1.200, and the
// Boolean forms in v2.1.218. The rule is inactive without `minVersion`.
import { describe, expect, it } from 'vitest'
import { agentText, lintRule } from '../agent-warn.test-support.ts'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, minVersion?: string, filename = local) => ({
  code: agentText(fields),
  filename,
  ...(minVersion === undefined ? {} : { options: [{ minVersion }] }),
})

markdownTester.run('agent-field-min-version', ruleOf('agent-field-min-version'), {
  valid: [
    // The rule is inactive with no minVersion.
    file('omitClaudeMd: true\n'),
    { ...file('omitClaudeMd: true\n'), options: [{}] },
    file('background: yes\npermissionMode: manual\nexperimental:\n  cacheTtl: 1h\n'),
    // The version that adds a field, and one above it.
    file('omitClaudeMd: true\n', '2.1.271'),
    file('omitClaudeMd: true\n', '2.2.0'),
    file('experimental:\n  cacheTtl: 5m\n', '2.1.248'),
    file('permissionMode: manual\n', '2.1.200'),
    file('background: yes\n', '2.1.218'),
    file('background: yes\n', '3.0.0'),
    // A field with no value, and a near miss of each field.
    file('omitClaudeMd:\n', '2.1.0'),
    file('experimental:\n', '2.1.0'),
    file('experimental: on\n', '2.1.0'),
    file('experimental:\n  cacheTtl:\n', '2.1.0'),
    file('experimental:\n  other: 1\n', '2.1.0'),
    file('permissionMode: default\n', '2.1.0'),
    file('permissionMode: plan\n', '2.1.0'),
    // A plugin agent ignores permissionMode.
    file('permissionMode: manual\n', '2.1.0', pluginAgent()),
    // The forms `true` and `false`, in any letter case, and the quoted text.
    file('background: true\nomitClaudeMd: false\n', '2.1.271'),
    file('background: TRUE\n', '2.1.0'),
    file('background: False\n', '2.1.0'),
    file('background: "true"\n', '2.1.0'),
    // A value that is no Boolean at all is for agent-frontmatter-schema.
    file('background: maybe\n', '2.1.0'),
    file('background: [yes]\n', '2.1.0'),
    file('background:\n', '2.1.0'),
    // A file that is no agent, or has no readable frontmatter.
    file('omitClaudeMd: true\n', '2.1.0', 'docs/a.md'),
    { code: '# No frontmatter\n', filename: local, options: [{ minVersion: '2.1.0' }] },
    { code: '---\nname: [unclosed\n---\n', filename: local, options: [{ minVersion: '2.1.0' }] },
  ],
  invalid: [
    {
      ...file('omitClaudeMd: true\n', '2.1.270'),
      errors: [
        {
          messageId: 'needsVersion',
          data: { field: 'omitClaudeMd', required: '2.1.271', minVersion: '2.1.270' },
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 13,
        },
      ],
    },
    // Each side of a version number.
    { ...file('omitClaudeMd: true\n', '1.99.99'), errors: [{ messageId: 'needsVersion' }] },
    { ...file('omitClaudeMd: true\n', '2.0.999'), errors: [{ messageId: 'needsVersion' }] },
    {
      ...file('experimental:\n  cacheTtl: 1h\n', '2.1.247'),
      errors: [
        {
          messageId: 'needsVersion',
          data: { field: 'experimental.cacheTtl', required: '2.1.248', minVersion: '2.1.247' },
          line: 4,
          column: 1,
          endColumn: 13,
        },
      ],
    },
    {
      ...file('permissionMode: manual\n', '2.1.199'),
      errors: [
        {
          messageId: 'needsVersion',
          data: { field: 'permissionMode: manual', required: '2.1.200', minVersion: '2.1.199' },
          line: 4,
          column: 17,
          endColumn: 23,
        },
      ],
    },
    // A plugin agent reads omitClaudeMd and cacheTtl.
    {
      ...file('omitClaudeMd: true\nexperimental:\n  cacheTtl: 5m\n', '2.1.0', pluginAgent()),
      errors: [
        {
          messageId: 'needsVersion',
          data: { field: 'omitClaudeMd', required: '2.1.271', minVersion: '2.1.0' },
          line: 4,
        },
        {
          messageId: 'needsVersion',
          data: { field: 'experimental.cacheTtl', required: '2.1.248', minVersion: '2.1.0' },
          line: 5,
        },
      ],
    },
    // A list entry value is a value, so omitClaudeMd with any value is set.
    { ...file('omitClaudeMd: false\n', '2.1.270'), errors: [{ messageId: 'needsVersion' }] },
    // Each Boolean form below v2.1.218.
    ...['yes', 'no', 'on', 'off', '1', '0', 'Yes', 'OFF'].map((form) => ({
      ...file(`background: ${form}\n`, '2.1.217'),
      errors: [
        {
          messageId: 'booleanForm' as const,
          data: { key: 'background', value: form, minVersion: '2.1.217' },
          line: 4,
          column: 13,
        },
      ],
    })),
    {
      ...file('omitClaudeMd: yes\nbackground: 0\n', '2.1.217'),
      errors: [
        {
          messageId: 'needsVersion',
          data: { field: 'omitClaudeMd', required: '2.1.271', minVersion: '2.1.217' },
          line: 4,
        },
        {
          messageId: 'booleanForm',
          data: { key: 'omitClaudeMd', value: 'yes', minVersion: '2.1.217' },
          line: 4,
        },
        {
          messageId: 'booleanForm',
          data: { key: 'background', value: '0', minVersion: '2.1.217' },
          line: 5,
        },
      ],
    },
    {
      ...file('background: yes\n', '2.0.0', pluginAgent()),
      errors: [{ messageId: 'booleanForm' }],
    },
  ],
})

describe('agent-field-min-version options', () => {
  it('rejects a minVersion that is not major.minor.patch', () => {
    const lint = (options: unknown[]) =>
      lintRule('agent-field-min-version', options, agentText(''), '/repo/.claude/agents/a.md')
    expect(() => lint([{ minVersion: '2.1' }])).toThrow(/should match pattern/)
    expect(() => lint([{ minVersion: 2 }])).toThrow()
    expect(lint([{ minVersion: '2.1.0' }])).toEqual([])
  })
})
