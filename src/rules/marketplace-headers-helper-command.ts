// The `headersHelper` of an entry is a command that Claude Code runs to get
// the headers of an archive download. The docs set rules for its text
// (docs/rules/marketplace-headers-helper-command.md). The docs fix 500 as the
// most characters, and no Claude Code setting moves it, so the schema sets 500
// as the maximum of the option `max`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-headers-helper-command' as const

// The limit in the docs, and the default of `max`.
const COMMAND_MAX = 500

type Options = [{ max: number }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'notPrintable' | 'tooLong' | 'overConfiguredLimit' | 'spaceRun' | 'relativePath'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the headersHelper command of an entry as the docs require',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: COMMAND_MAX } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: COMMAND_MAX }],
    messages: {
      notPrintable:
        'The "headersHelper" command must be printable ASCII, and it has another character.',
      tooLong:
        'The "headersHelper" command has {{length}} characters. The docs allow at most {{max}}.',
      overConfiguredLimit:
        'The "headersHelper" command has {{length}} characters. The configured limit is {{max}}.',
      spaceRun: 'The "headersHelper" command has a run of four or more spaces.',
      relativePath:
        'The "headersHelper" command starts with the relative path "{{word}}". Claude Code resolves it against its configuration directory, not the project.',
    },
  },
  create() {
    return {}
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
