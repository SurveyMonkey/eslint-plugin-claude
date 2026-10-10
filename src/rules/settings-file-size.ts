// The size of a settings file (docs/rules/settings-file-size.md). The docs fix
// 2 MiB as the most bytes of a `--settings` file, and no Claude Code setting
// moves it. So the schema sets that number as the maximum of the option `max`.
// The rule counts the UTF-8 bytes of the text that ESLint gives it. The parser
// removes a byte order mark before that, so the rule does not count its 3 bytes.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-file-size' as const

// The limit in the docs, and the default of `max`: 2 MiB.
const FILE_MAX = 2097152

type Options = [{ max: number }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooLarge' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a settings file at or under 2 MiB',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: FILE_MAX } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: FILE_MAX }],
    messages: {
      tooLarge:
        'This settings file has {{size}} bytes. Claude Code refuses a --settings file of more than {{max}} bytes.',
      overConfiguredLimit:
        'This settings file has {{size}} bytes. The configured limit is {{max}} bytes.',
    },
  },
  create(context) {
    // Claude Code does not load a hidden drop-in, so the rule does not check it.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ max }] = context.options
    return {
      Document() {
        const size = Buffer.byteLength(context.sourceCode.text, 'utf8')
        if (size > max) {
          context.report({
            // The JSON language counts columns from 1.
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: max === FILE_MAX ? 'tooLarge' : 'overConfiguredLimit',
            data: { size: String(size), max: String(max) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
