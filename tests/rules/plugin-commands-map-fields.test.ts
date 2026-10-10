// An entry in the object map of `commands` has the fields of the table in the manifest reference
// ("commands"). `claude plugin validate` passes a field that is not in the table, and rejects a bad
// type of a listed field, so the rule reads the names only. The files glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-commands-map-fields'
const check = it.fails

const message = (field: string) =>
  `\`${field}\` is not a field of a command entry. The manifest reference lists \`source\`, \`content\`, \`description\`, \`argumentHint\`, \`model\` and \`allowedTools\`.`
const run = (commands: unknown) => {
  const { dir, code } = pluginTree({ name: 'p', commands })
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports an unknown field, with the full message and the position of the key', () => {
    const found = run({ status: { source: './commands/status.md', bogus: 1 } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unknown',
      message: message('bogus'),
      line: 1,
      column: 65,
      endLine: 1,
      endColumn: 72,
    })
  })

  check('reports each unknown field of each entry, in file order', () => {
    const found = run({
      a: { source: './a.md', tools: [], model: 'm', extra: true },
      b: { content: 'x', hint: '[a]' },
      c: { source: './c.md' },
    })
    expect(found.map((m) => m.message)).toEqual([
      message('tools'),
      message('extra'),
      message('hint'),
    ])
  })

  check.each([
    ['a name in another case', 'Source'],
    ['a snake case name', 'argument_hint'],
    ['a name of the skill frontmatter', 'allowed-tools'],
    ['an empty name', ''],
  ])('reports %s', (_title, field) => {
    expect(run({ a: { source: './a.md', [field]: 'x' } }).map((m) => m.message)).toEqual([
      message(field),
    ])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(
      { name: 'p', commands: { a: { source: './a.md', bogus: 1 } } },
      {},
      'plugins/p/',
    )
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['unknown'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['source', './commands/a.md'],
    ['description', 'd'],
    ['argumentHint', '[file]'],
    ['model', 'sonnet'],
    ['allowedTools', ['Bash']],
  ])('stays silent for the field %s', (field, value) => {
    expect(run({ a: { source: './commands/a.md', [field]: value } })).toEqual([])
  })

  check('stays silent for the field content', () => {
    expect(run({ a: { content: 'Explain the plugin.' } })).toEqual([])
  })

  check('stays silent for every field at once', () => {
    expect(
      run({
        a: {
          source: './a.md',
          description: 'd',
          argumentHint: '[x]',
          model: 'm',
          allowedTools: ['Bash'],
        },
      }),
    ).toEqual([])
  })

  // Validate rejects the type of a listed field, so the rule leaves it alone.
  check('stays silent for a listed field with a wrong type', () => {
    expect(run({ a: { source: './a.md', allowedTools: 'Bash', description: 3 } })).toEqual([])
  })

  check.each([
    ['a path', './commands/a.md'],
    ['an array of paths', ['./commands/a.md']],
    ['an array of objects', [{ bogus: 1 }]],
    ['a number', 3],
    ['null', null],
    ['an entry that is a string', { a: './commands/a.md' }],
    ['an entry that is an array', { a: [{ bogus: 1 }] }],
    ['an entry that is null', { a: null }],
    ['an empty map', {}],
  ])('stays silent for commands as %s', (_title, commands) => {
    expect(run(commands)).toEqual([])
  })

  check('stays silent for an unknown key outside the commands map', () => {
    const { dir, code } = pluginTree({
      name: 'p',
      bogus: 1,
      metadata: { commands: { a: { bogus: 1 } } },
      commands: { a: { source: './a.md' } },
    })
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('reads the last of two commands keys', () => {
    const { dir, code } = pluginTree(
      '{"name": "p", "commands": {"a": {"bogus": 1}}, "commands": {"a": {"source": "./a.md"}}}',
    )
    expect(lintPlugin(RULE, dir, code)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(
      lintPlugin(RULE, dir, '{"name": "p", "commands": {"a": {"source": "./a.md", "bogus": 1}}}'),
    ).toEqual([])
  })
})
