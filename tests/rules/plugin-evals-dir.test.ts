// The eval directory of a plugin is the relative path in `experimental.evals` of the manifest, made of
// plain directory names (plugin evals page, "Use a different eval directory"). Claude Code prints a
// `Warning:` line for any other value and uses `evals/`. The rule reads the manifest only. The files
// glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const RULE = 'plugin-evals-dir'
const check = it.fails
const FILE = '/p/.claude-plugin/plugin.json'
const lint = (code: string) => lintJson(RULE, code, FILE)
const manifest = (evals: unknown) => JSON.stringify({ name: 'p', experimental: { evals } })

const UNUSABLE = (value: string) =>
  `Claude Code does not use ${value} as the eval directory. It prints a warning and uses "evals/". Write a relative path of plain directory names, such as "qa" or "quality/evals".`
const NOT_STRING =
  'The value of `experimental.evals` must be a string. Claude Code prints a warning and uses "evals/". Write a relative path of plain directory names, such as "qa" or "quality/evals".'

describe(RULE, () => {
  check('reports a path with a parent segment, on the value, with the full message', () => {
    const code = manifest('../x')
    const found = lint(code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'unusable',
      message: UNUSABLE('"../x"'),
      line: 1,
      column: code.indexOf('"../x"') + 1,
      endColumn: code.indexOf('"../x"') + '"../x"'.length + 1,
    })
  })

  check.each([
    ['an absolute path', '/etc/evals', '"/etc/evals"'],
    ['a path with a drive letter', 'C:\\evals', '"C:\\\\evals"'],
    ['a path with a backslash', 'qa\\evals', '"qa\\\\evals"'],
    ['a path with a dot segment', './qa', '"./qa"'],
    ['a path with a parent segment in the middle', 'a/../b', '"a/../b"'],
    ['an empty string', '', '""'],
    ['an empty segment', 'a//b', '"a//b"'],
    ['a trailing separator', 'qa/', '"qa/"'],
  ])('reports %s', (_title, value, shown) => {
    expect(lint(manifest(value)).map((m) => m.message)).toEqual([UNUSABLE(shown)])
  })

  check.each([
    ['a number', 5],
    ['a Boolean', true],
    ['null', null],
    ['an object', {}],
    ['a list', ['qa']],
  ])('reports a value that is %s', (_title, value) => {
    expect(lint(manifest(value)).map((m) => m.message)).toEqual([NOT_STRING])
  })

  check.each([
    ['a plain name', 'qa'],
    ['a nested path', 'quality/evals'],
    ['a name that starts like the default', 'evals2'],
    ['a name with dots in it', 'my.evals'],
    ['the default', 'evals'],
  ])('stays silent for %s', (_title, value) => {
    expect(lint(manifest(value))).toEqual([])
  })

  check('stays silent when the key is absent or the parent is not an object', () => {
    expect(lint('{"name": "p"}')).toEqual([])
    expect(lint('{"experimental": {}}')).toEqual([])
    expect(lint('{"experimental": "x"}')).toEqual([])
    expect(lint('[]')).toEqual([])
    expect(lint('{"experimental": {"themes": "../x"}}')).toEqual([])
  })

  check('reads the last of two members, as JSON.parse keeps the last', () => {
    expect(lint('{"experimental": {"evals": "../x", "evals": "qa"}}')).toEqual([])
    expect(lint('{"experimental": {"evals": "qa", "evals": "../x"}}')).toHaveLength(1)
  })

  check('stays silent for a name that is not experimental.evals at the top level', () => {
    expect(lint('{"evals": "../x"}')).toEqual([])
  })
})
