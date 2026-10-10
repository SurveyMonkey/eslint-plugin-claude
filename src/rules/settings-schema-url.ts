// The `$schema` key of a settings file (docs/rules/settings-schema-url.md). The settings page
// gives the URL of the published JSON schema. An editor uses it to complete and check the keys.
// Claude Code does not read the key. The rule reports a file with no `$schema`, and a `$schema`
// with another value.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-schema-url' as const

const SCHEMA_URL = 'https://json.schemastore.org/claude-code-settings.json'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'missing' | 'wrongUrl' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Point "$schema" of a settings file at the Claude Code settings schema',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing: `Add "$schema": "${SCHEMA_URL}". An editor then completes and checks the keys.`,
      wrongUrl: `"$schema" must be "${SCHEMA_URL}", the published schema for Claude Code settings.`,
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }
        const member = lastMember(body, '$schema')
        if (member === undefined) {
          // The start of the file, not the whole object, so that an editor marks one character.
          const { start } = body.loc
          context.report({
            loc: { start, end: { line: start.line, column: start.column + 1 } },
            messageId: 'missing',
          })
        } else if (member.value.type !== 'String' || member.value.value !== SCHEMA_URL) {
          context.report({ node: member.value, messageId: 'wrongUrl' })
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
