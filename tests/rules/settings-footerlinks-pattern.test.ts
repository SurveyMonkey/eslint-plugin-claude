// The expected values come from the settings reference
// (https://code.claude.com/docs/en/settings-reference#badge-constraints): "Constructed URLs longer
// than 2048 characters are dropped", a label "is truncated to 28 display columns", and "Nested
// quantifiers such as `(a+)+$` can take exponentially long against certain inputs and freeze the
// session, so keep each `pattern` linear and avoid nesting `+` or `*`". The files glob is in
// `tests/configs.test.ts`.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const name = 'settings-footerlinks-pattern'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

/** The messages of the rule for `code` at `file`, with the options `options`. */
function lint(code: string, file = MANAGED, options: object[] = []) {
  const absolute = path.resolve(file)
  return new Linter({ cwd: path.parse(absolute).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: ['error', ...options] },
      },
    ],
    { filename: absolute },
  )
}
const ids = (code: string, file = MANAGED, options: object[] = []) =>
  lint(code, file, options).map((m) => m.messageId)

const URL = 'https://issues.example.com/browse/'
/** The text of a settings file with one entry. */
const entry = (fields: object) =>
  JSON.stringify({
    footerLinksRegexes: [{ type: 'regex', pattern: 'a', url: URL, ...fields }],
  })
const withPattern = (pattern: string) => ids(entry({ pattern }))
/** A URL template of `length` characters. */
const urlOf = (length: number, tail = '') =>
  `${URL}${'x'.repeat(length - URL.length - tail.length)}${tail}`

describe(`${name}: the pattern`, () => {
  it('reports a quantifier in a group that a quantifier follows', () => {
    for (const pattern of [
      '(a+)+',
      '(a*)*',
      '(a+)*',
      '(a*)+',
      '(a+)+$',
      '^(a+)+$',
      '(a+)+?',
      '(a|b+)+',
      '(?:a+)+',
      '(?<key>PROJ-\\d+)+',
      '((a+)b)+',
      '((a)+b)+',
      '(x(y(z+)))+',
      '\\\\(a+)+',
      '[a](b+)+',
    ]) {
      expect(withPattern(pattern), pattern).toEqual(['nested'])
    }
  })

  it('reports each entry, and the pattern node', () => {
    const text = JSON.stringify({
      footerLinksRegexes: [
        { type: 'regex', pattern: '(a+)+', url: URL },
        { type: 'regex', pattern: 'b', url: URL },
        { type: 'regex', pattern: '(c*)*', url: URL },
      ],
    })
    expect(ids(text)).toEqual(['nested', 'nested'])
    const [message] = lint('{\n  "footerLinksRegexes": [{ "pattern": "(a+)+" }]\n}')
    expect([message?.line, message?.column]).toEqual([2, 39])
  })

  it('is silent for a linear pattern', () => {
    for (const pattern of [
      '\\b(?<key>PROJ-\\d+)\\b',
      'a+',
      'a+b+',
      '(a+)',
      '(a+)?',
      '(a+){2}',
      '(a)+',
      '(a)(b+)',
      '(a+)b+',
      '(\\d+)\\+',
      '(a+)\\*',
      '\\(a+\\)+',
      '[(a+]+',
      '[+*]+',
      '([+*])+',
      '[^)]+',
      '(a+',
      'a+)+',
      ')+',
      ')(',
      '(',
      '',
      '(?=a+)',
      '(?<=b)a+',
      '[]+',
      '[\\](a+)+]',
      '\\',
    ]) {
      expect(withPattern(pattern), pattern).toEqual([])
    }
  })

  it('makes no crash for text that is not a regex', () => {
    for (const pattern of ['[a', '(?<', '(?<k', '*', '+', '(*)+', '\\(', 'a{', '(a{1,}', '((((']) {
      expect(() => withPattern(pattern), pattern).not.toThrow()
    }
    expect(withPattern('(?<n>a+)+[')).toEqual(['nested'])
    expect(withPattern('[(a+)+')).toEqual([])
  })

  it('is silent for a pattern that is not a string', () => {
    for (const pattern of [1, null, true, ['(a+)+'], { p: '(a+)+' }]) {
      expect(ids(entry({ pattern })), JSON.stringify(pattern)).toEqual([])
    }
    expect(ids('{"footerLinksRegexes": [{"type": "regex", "url": "x"}]}')).toEqual([])
  })
})

describe(`${name}: the URL template`, () => {
  it('reports a template over 2048 characters, and not one at 2048', () => {
    expect(ids(entry({ url: urlOf(2048) }))).toEqual([])
    expect(ids(entry({ url: urlOf(2049) }))).toEqual(['urlTooLong'])
    expect(ids(entry({ url: urlOf(5000) }))).toEqual(['urlTooLong'])
  })

  it('does not count a placeholder', () => {
    expect(ids(entry({ url: urlOf(2049, '{key}') }))).toEqual([])
    expect(ids(entry({ url: urlOf(2054, '{key}') }))).toEqual(['urlTooLong'])
    expect(ids(entry({ url: urlOf(2049, '{key}{n}{ab_1}') }))).toEqual([])
    // Braces that are not a placeholder count.
    expect(ids(entry({ url: urlOf(2049, '{}') }))).toEqual(['urlTooLong'])
    expect(ids(entry({ url: urlOf(2049, '{a b}') }))).toEqual(['urlTooLong'])
  })

  it('names the length and the limit', () => {
    const [message] = lint(entry({ url: urlOf(2060, '{key}') }))
    expect(message?.message).toBe(
      'This URL template has 2055 characters without its placeholders. Claude Code drops a constructed URL of more than 2048 characters.',
    )
  })

  it('is silent for a url that is not a string', () => {
    for (const url of [1, null, ['x'], { u: 'x' }]) {
      expect(ids(entry({ url })), JSON.stringify(url)).toEqual([])
    }
  })

  it('takes the option maxUrlChars', () => {
    const options = [{ maxUrlChars: 100 }]
    expect(ids(entry({ url: urlOf(100) }), MANAGED, options)).toEqual([])
    expect(ids(entry({ url: urlOf(101) }), MANAGED, options)).toEqual(['overConfiguredUrlLimit'])
    // The label keeps its default limit beside the option.
    expect(ids(entry({ label: 'x'.repeat(29) }), MANAGED, options)).toEqual(['labelTooWide'])
    const [message] = lint(entry({ url: urlOf(101) }), MANAGED, options)
    expect(message?.message).toBe(
      'This URL template has 101 characters without its placeholders. The configured limit is 100 characters.',
    )
    // An option equal to the default gives the message of the docs limit.
    expect(ids(entry({ url: urlOf(2049) }), MANAGED, [{ maxUrlChars: 2048 }])).toEqual([
      'urlTooLong',
    ])
  })
})

describe(`${name}: the label`, () => {
  it('reports a label over 28 columns, and not one at 28', () => {
    expect(ids(entry({ label: 'x'.repeat(28) }))).toEqual([])
    expect(ids(entry({ label: 'x'.repeat(29) }))).toEqual(['labelTooWide'])
    expect(ids(entry({ label: '' }))).toEqual([])
  })

  it('does not count a placeholder', () => {
    expect(ids(entry({ label: `${'x'.repeat(28)}{key}` }))).toEqual([])
    expect(ids(entry({ label: `{key}${'x'.repeat(29)}` }))).toEqual(['labelTooWide'])
  })

  it('counts a wide character as two columns, and a mark as none', () => {
    // 14 wide characters are 28 columns. 15 are 30.
    expect(ids(entry({ label: '漢'.repeat(14) }))).toEqual([])
    expect(ids(entry({ label: '漢'.repeat(15) }))).toEqual(['labelTooWide'])
    expect(ids(entry({ label: 'あ'.repeat(15) }))).toEqual(['labelTooWide'])
    expect(ids(entry({ label: '한'.repeat(15) }))).toEqual(['labelTooWide'])
    expect(ids(entry({ label: '😀'.repeat(14) }))).toEqual([])
    expect(ids(entry({ label: '😀'.repeat(15) }))).toEqual(['labelTooWide'])
    // A combining accent and a zero-width joiner take no column.
    expect(ids(entry({ label: 'é'.repeat(28) }))).toEqual([])
    expect(ids(entry({ label: 'é'.repeat(29) }))).toEqual(['labelTooWide'])
    expect(ids(entry({ label: `${'x'.repeat(28)}‍` }))).toEqual([])
  })

  it('names the width and the limit', () => {
    const [message] = lint(entry({ label: 'x'.repeat(30) }))
    expect(message?.message).toBe(
      'This label is 30 columns wide without its placeholders. Claude Code cuts a label to 28 display columns.',
    )
  })

  it('is silent for a label that is not a string, or for no label', () => {
    for (const label of [1, null, ['x'.repeat(40)]]) {
      expect(ids(entry({ label })), JSON.stringify(label)).toEqual([])
    }
  })

  it('takes the option maxLabelColumns', () => {
    const options = [{ maxLabelColumns: 10 }]
    expect(ids(entry({ label: 'x'.repeat(10) }), MANAGED, options)).toEqual([])
    expect(ids(entry({ label: 'x'.repeat(11) }), MANAGED, options)).toEqual([
      'overConfiguredLabelLimit',
    ])
    // The URL keeps its default limit beside the option.
    expect(ids(entry({ url: urlOf(2049) }), MANAGED, options)).toEqual(['urlTooLong'])
    const [message] = lint(entry({ label: 'x'.repeat(11) }), MANAGED, options)
    expect(message?.message).toBe(
      'This label is 11 columns wide without its placeholders. The configured limit is 10 columns.',
    )
    expect(ids(entry({ label: 'x'.repeat(29) }), MANAGED, [{ maxLabelColumns: 28 }])).toEqual([
      'labelTooWide',
    ])
  })
})

describe(`${name}: the file`, () => {
  const bad = entry({ pattern: '(a+)+', url: urlOf(2049), label: 'x'.repeat(29) })

  it('reports all three faults of one entry, in a managed file and a drop-in', () => {
    for (const file of [MANAGED, DROP_IN]) {
      expect(ids(bad, file), file).toEqual(['nested', 'urlTooLong', 'labelTooWide'])
    }
  })

  it('is silent for a hidden drop-in', () => {
    expect(ids(bad, HIDDEN)).toEqual([])
  })

  it('is silent when footerLinksRegexes is missing or has another shape', () => {
    for (const code of [
      '{}',
      '[]',
      '{"footerLinksRegexes": null}',
      '{"footerLinksRegexes": "(a+)+"}',
      '{"footerLinksRegexes": {"pattern": "(a+)+"}}',
      '{"footerLinksRegexes": []}',
      '{"footerLinksRegexes": ["(a+)+", 1, null, [{"pattern": "(a+)+"}]]}',
    ]) {
      expect(ids(code), code).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    const list = (pattern: string) => `[{"type":"regex","pattern":"${pattern}","url":"x"}]`
    expect(
      ids(`{"footerLinksRegexes":${list('(a+)+')},"footerLinksRegexes":${list('a')}}`),
    ).toEqual([])
    expect(
      ids(`{"footerLinksRegexes":${list('a')},"footerLinksRegexes":${list('(a+)+')}}`),
    ).toEqual(['nested'])
    expect(
      ids('{"footerLinksRegexes":[{"pattern":"(a+)+","pattern":"a","url":"x","url":"y"}]}'),
    ).toEqual([])
  })
})

// The schema of the options: an integer from 1 to the docs limit, and no other key.
describe(`${name}: option schema`, () => {
  it('accepts an empty object and each integer from 1 to the docs limit', () => {
    expect(() => lint('{}', MANAGED, [{}])).not.toThrow()
    expect(() => lint('{}', MANAGED, [{ maxUrlChars: 1, maxLabelColumns: 1 }])).not.toThrow()
    expect(() => lint('{}', MANAGED, [{ maxUrlChars: 2048, maxLabelColumns: 28 }])).not.toThrow()
  })

  it('refuses 0, a fraction, a value above the docs limit, and an unknown key', () => {
    for (const option of [
      { maxUrlChars: 0 },
      { maxUrlChars: 1.5 },
      { maxUrlChars: 2049 },
      { maxLabelColumns: 0 },
      { maxLabelColumns: 2.5 },
      { maxLabelColumns: 29 },
      { max: 1 },
    ]) {
      expect(() => lint('{}', MANAGED, [option]), JSON.stringify(option)).toThrow()
    }
  })
})
