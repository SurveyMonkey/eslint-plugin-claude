// An entry in the object map of `commands` has the fields of the table in the manifest reference
// (docs/rules/plugin-commands-map-fields.md). The rule reports a field that is not in the table.
// It makes no report when it cannot see the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_COMMAND_FIELDS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-commands-map-fields' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unknown' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use only the documented fields in an entry of the commands map of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        '`{{field}}` is not a field of a command entry. The manifest reference lists `source`, `content`, `description`, `argumentHint`, `model` and `allowedTools`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const commands = lastMember(node.body, 'commands')?.value
        if (plugin === undefined || commands?.type !== 'Object') {
          return
        }
        for (const entry of commands.members) {
          if (entry.value.type !== 'Object') {
            continue
          }
          for (const member of entry.value.members) {
            const field = keyOf(member.name)
            if (!PLUGIN_COMMAND_FIELDS.includes(field)) {
              context.report({ node: member.name, messageId: 'unknown', data: { field } })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
