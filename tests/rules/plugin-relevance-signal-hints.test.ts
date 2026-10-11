// A `relevance` block of a marketplace entry has two signals with a hint in the docs. Claude Code
// records one command name for each shell command, so a `cli` entry is one token: "Exact match"
// (relevance page, "Command name matching"). A `manifestDeps` `file` pattern matches the path of a
// manifest file, "typically absolute, so anchor the pattern at the end rather than the start"
// ("Manifest dependency matching"). The rule reports a `cli` entry with white space and a `file`
// pattern that starts with `^`. It reads the linted file only.
import { describe, expect, it } from 'vitest'
import { lintMarketplace, marketplaceOf, tree } from '../marketplace-tree.test-support.ts'

const RULE = 'plugin-relevance-signal-hints'
const check = it.fails

const cliMessage = (entry: string) =>
  `The \`cli\` entry "${entry}" has white space. Claude Code records one command name for each shell command: the first token after any environment variable assignments and \`sudo\`. The entry is an exact match, so it never matches. Write the command name only.`
const fileMessage = (pattern: string) =>
  `The \`file\` pattern "${pattern}" starts with \`^\`. Claude Code matches it against the path of a manifest file, which is typically absolute, so it never matches. Anchor the pattern at the end, for example \`[/\\\\]package\\.json$\`.`

const entryOf = (signals: unknown) => ({
  name: 'tf',
  source: './plugins/tf',
  relevance: { topic: 'Terraform', signals },
})
const run = (signals: unknown, extra: unknown[] = []) => {
  const dir = tree({})
  return lintMarketplace(RULE, dir, marketplaceOf([entryOf(signals), ...extra]))
}
const messages = (signals: unknown) => run(signals).map((m) => m.message)

describe(RULE, () => {
  check('reports a cli entry with a space, with the full message and the location', () => {
    const code = marketplaceOf([entryOf({ cli: ['terraform plan'] })])
    const found = lintMarketplace(RULE, tree({}), code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'cli',
      message: cliMessage('terraform plan'),
      line: 1,
      column: code.indexOf('"terraform plan"') + 1,
      endColumn: code.indexOf('"terraform plan"') + 1 + '"terraform plan"'.length,
    })
  })

  check(
    'reports a manifestDeps file pattern that starts with a caret, with the full message',
    () => {
      const found = run({ manifestDeps: [{ file: '^package\\.json$', pattern: '"sdk"' }] })
      expect(found).toHaveLength(1)
      expect(found[0]).toMatchObject({
        messageId: 'file',
        message: fileMessage('^package\\.json$'),
      })
    },
  )

  check('reports any white space in a cli entry', () => {
    expect(messages({ cli: ['sudo terraform', 'a\tb', ' terraform', 'terraform '] })).toEqual([
      cliMessage('sudo terraform'),
      cliMessage('a\tb'),
      cliMessage(' terraform'),
      cliMessage('terraform '),
    ])
  })

  check('reports each bad entry and each bad pattern in file order', () => {
    const signals = {
      cli: ['terraform', 'kubectl get'],
      manifestDeps: [
        { file: '[/\\\\]package\\.json$', pattern: 'x' },
        { file: '^a', pattern: 'x' },
        { file: '^b', pattern: 'x' },
      ],
    }
    expect(messages(signals)).toEqual([
      cliMessage('kubectl get'),
      fileMessage('^a'),
      fileMessage('^b'),
    ])
  })

  check('reports in every entry of the marketplace', () => {
    const second = {
      name: 'k8s',
      source: './plugins/k8s',
      relevance: { signals: { cli: ['a b'] } },
    }
    expect(run({ cli: ['c d'] }, [second]).map((m) => m.message)).toEqual([
      cliMessage('c d'),
      cliMessage('a b'),
    ])
  })

  check('reads the last of two repeated keys', () => {
    const code =
      '{"name":"a","owner":{"name":"o"},"plugins":[{"name":"t","source":"./t","relevance":{"signals":{"cli":["x y"]},"signals":{"cli":["z"]}}}]}'
    expect(lintMarketplace(RULE, tree({}), code)).toEqual([])
  })

  check.each([
    ['one command name', { cli: ['terraform', 'kubectl'] }],
    ['a name with a dot and a dash', { cli: ['docker-compose', 'python3.12'] }],
    ['an anchor at the end', { manifestDeps: [{ file: '[/\\\\]package\\.json$', pattern: 'x' }] }],
    ['no anchor', { manifestDeps: [{ file: 'package\\.json', pattern: 'x' }] }],
    ['a caret in the middle', { manifestDeps: [{ file: 'a|^b', pattern: 'x' }] }],
    ['a group at the start', { manifestDeps: [{ file: '(^|/)package\\.json$', pattern: 'x' }] }],
    ['a caret in the pattern, not the file', { manifestDeps: [{ file: 'a$', pattern: '^x' }] }],
    ['another signal with white space', { cwd: ['a b'], hosts: ['a b'], filesRead: ['a b'] }],
  ])('stays silent for %s', (_title, signals) => {
    expect(run(signals)).toEqual([])
  })

  check.each([
    ['cli that is a string', { cli: 'a b' }],
    ['cli with a number', { cli: [1, { a: 'b c' }] }],
    ['manifestDeps that is an object', { manifestDeps: { file: '^a' } }],
    ['manifestDeps with a string and a number', { manifestDeps: ['^a', 3] }],
    ['a file that is a number', { manifestDeps: [{ file: 1 }] }],
    ['no file', { manifestDeps: [{ pattern: '^a' }] }],
    ['signals that is an array', [{ cli: ['a b'] }]],
    ['signals that is a string', 'cli'],
    ['no signals', undefined],
  ])('stays silent for a value of the wrong shape: %s', (_title, signals) => {
    expect(run(signals)).toEqual([])
  })

  check('stays silent when relevance is not an object or is missing', () => {
    const code = marketplaceOf([
      { name: 'a', source: './a', relevance: 'cli' },
      { name: 'b', source: './b' },
      { name: 'c', source: './c', relevance: ['x y'] },
    ])
    expect(lintMarketplace(RULE, tree({}), code)).toEqual([])
  })
})
