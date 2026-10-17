// The sub-agents page, "Preload skills into subagents": "The full content of each listed skill
// is injected into the subagent's context at startup, up to the first 32 distinct names in the
// list."
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginAgent } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const local = '.claude/agents/a.md'
const file = (fields: string, filename = local) => ({
  code: `---\nname: a\ndescription: d\n${fields}---\n\nBody.\n`,
  filename,
})
// The names s01, s02 and on, as a YAML list of one name on each line.
const names = (count: number) =>
  Array.from({ length: count }, (_, i) => `s${String(i + 1).padStart(2, '0')}`)
const list = (entries: string[]) => `skills:\n${entries.map((e) => `  - ${e}\n`).join('')}`

markdownTester.run('agent-skills-preload-limit', ruleOf('agent-skills-preload-limit'), {
  valid: [
    file(list(names(32))),
    // 33 entries, and s01 twice: 32 distinct names.
    file(list([...names(32), 's01'])),
    // A name that differs from another only in case counts once.
    file(list([...names(32), 'S01'])),
    file(list(names(10)), local),
    { ...file(list(names(10))), options: [{ max: 10 }] },
    file(list(names(33)), 'docs/a.md'),
    file('skills: []\n'),
    file('skills:\n'),
    file(''),
    // A value that is not a list is for `agent-frontmatter-schema`.
    file(`skills: ${names(33).join(', ')}\n`),
    { code: '# Agent\n', filename: local },
    { code: '---\nname: [unclosed\n---\n', filename: local },
  ],
  invalid: [
    {
      ...file(list(names(33))),
      errors: [
        {
          messageId: 'overPreloadLimit',
          data: { count: '33', max: '32', first: 's33' },
          line: 5,
          column: 3,
          endLine: 37,
          endColumn: 8,
        },
      ],
    },
    {
      ...file(list([...names(33), 's02', 's34'])),
      errors: [{ messageId: 'overPreloadLimit', data: { count: '34', max: '32', first: 's33' } }],
    },
    {
      ...file(`skills: [${names(33).join(', ')}]\n`),
      errors: [
        {
          messageId: 'overPreloadLimit',
          data: { count: '33', max: '32', first: 's33' },
          line: 4,
          column: 9,
        },
      ],
    },
    {
      ...file(list(names(33)), pluginAgent()),
      errors: [{ messageId: 'overPreloadLimit', data: { count: '33', max: '32', first: 's33' } }],
    },
    {
      ...file(list(names(33)), '.claude/agents/review/a.md'),
      errors: [{ messageId: 'overPreloadLimit' }],
    },
    {
      ...file(list(names(11))),
      options: [{ max: 10 }],
      errors: [
        { messageId: 'overConfiguredLimit', data: { count: '11', max: '10', first: 's11' } },
      ],
    },
  ],
})

describe('the message and the option of agent-skills-preload-limit', () => {
  const lint = (code: string, options: unknown[] = []) =>
    lintMarkdown('agent-skills-preload-limit', code, path.resolve(local), options)

  it('names the count, the limit and the first name that is not preloaded', () => {
    const [report, ...rest] = lint(file(list(names(33))).code)
    expect(rest).toEqual([])
    expect(report?.message).toBe(
      '`skills` lists 33 distinct names. Claude Code preloads only the first 32, so `s33` and each later name are not preloaded, with no error.',
    )
  })

  it('names the configured limit, and claims no skip', () => {
    const [report, ...rest] = lint(file(list(names(11))).code, [{ max: 10 }])
    expect(rest).toEqual([])
    expect(report?.message).toBe(
      '`skills` lists 11 distinct names. The configured limit is 10, and `s11` is over it.',
    )
  })

  it('refuses an option above 32', () => {
    expect(() => lint(file('').code, [{ max: 32 }])).not.toThrow()
    expect(() => lint(file('').code, [{ max: 33 }])).toThrow('Value 33 should be <= 32.')
  })

  it('refuses an option of 0, of 6.5, or with an unknown key', () => {
    expect(() => lint(file('').code, [{ max: 0 }])).toThrow()
    expect(() => lint(file('').code, [{ max: 6.5 }])).toThrow()
    expect(() => lint(file('').code, [{ other: 1 }])).toThrow()
  })
})
