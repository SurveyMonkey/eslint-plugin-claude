// A `Read` or `Edit` specifier is a gitignore pattern. An allow rule with a pattern that Claude
// Code cannot use approves nothing. A deny or ask rule guards the literal path only
// (docs/rules/permissions-invalid-path-pattern.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { GITIGNORE_TOOLS, hasUnclosedBracket, pathSpecifier } from '../permission-path.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-invalid-path-pattern' as const

type MessageId = 'approvesNothing' | 'guardsLiteralPath'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a Read or Edit specifier as a valid gitignore pattern',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      approvesNothing:
        '`{{rule}}` has a `[` with no `]` after it, so it is not a usable gitignore pattern. A rule in `allow` with such a pattern approves nothing.',
      guardsLiteralPath:
        '`{{rule}}` has a `[` with no `]` after it, so it is not a usable gitignore pattern. A rule in `{{list}}` with such a pattern guards only the literal path.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const specifier = pathSpecifier(entry, GITIGNORE_TOOLS)
        if (specifier === null || !hasUnclosedBracket(specifier)) {
          continue
        }
        context.report({
          loc: entry.loc,
          messageId: entry.list === 'allow' ? 'approvesNothing' : 'guardsLiteralPath',
          data: { rule: `${entry.rule.tool}(${specifier})`, list: entry.list },
        })
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
