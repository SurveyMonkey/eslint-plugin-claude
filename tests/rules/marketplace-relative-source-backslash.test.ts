// The rule reads each `source` of `plugins` in `.claude-plugin/marketplace.json`. Each path
// that `marketplace-relative-source-format` reports is in `valid` here, so that no path has two
// reports. The files glob is in tests/configs.test.ts.
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-relative-source-backslash')
const filename = '.claude-plugin/marketplace.json'
const manifest = (...sources: unknown[]) =>
  JSON.stringify({
    name: 'acme',
    plugins: sources.map((source, i) => ({ name: `p${i}`, source })),
  })

jsonTester.run('marketplace-relative-source-backslash (valid)', rule, {
  valid: [
    { code: manifest('./plugins/a', '.', './a..b', './plugins/a/'), filename },
    // The format rule reports each of these. This rule stays silent.
    { code: manifest('\\\\server\\share\\p'), filename },
    { code: manifest('\\plugins\\a', 'C:\\plugins\\a', 'C:/plugins/a'), filename },
    { code: manifest('/plugins/a'), filename },
    { code: manifest('./a\\..\\b', '.\\a', 'plugins\\a', 'a\\b'), filename },
    { code: manifest('../a\\b'), filename },
    // A bare name has no backslash, and a path with no `./` is for the format rule.
    { code: manifest('plugins/a', 'formatter'), filename },
    // A value of the wrong type is for `marketplace-schema`.
    { code: manifest({ source: 'github', repo: 'a\\b' }, 3, null, ['./a\\b']), filename },
    { code: manifest(), filename },
    { code: JSON.stringify({ name: 'acme', plugins: { source: './a\\b' } }), filename },
    { code: '[]', filename },
    // Two `source` keys. The rule reads the last, as `JSON.parse` does.
    { code: '{"plugins": [{"name": "p", "source": "./a\\\\b", "source": "./a/b"}]}', filename },
  ],
  invalid: [],
})

jsonTester.run('marketplace-relative-source-backslash (invalid)', rule, {
  valid: [],
  invalid: [
    {
      code: manifest('./plugins\\a'),
      filename,
      errors: [
        {
          messageId: 'backslash',
          data: { path: './plugins\\a' },
          line: 1,
          column: 49,
          endColumn: 63,
        },
      ],
    },
    // A backslash anywhere after the `./`, and each entry reports once.
    {
      code: manifest('./a/b\\c', './\\a', './a\\', './ok', './a\\b\\c'),
      filename,
      errors: [
        { messageId: 'backslash' },
        { messageId: 'backslash' },
        { messageId: 'backslash' },
        { messageId: 'backslash' },
      ],
    },
    // Two `source` keys. `JSON.parse` keeps the last.
    {
      code: '{"plugins": [{"name": "p", "source": "./a", "source": "./a\\\\b"}]}',
      filename,
      errors: [{ messageId: 'backslash' }],
    },
  ],
})
