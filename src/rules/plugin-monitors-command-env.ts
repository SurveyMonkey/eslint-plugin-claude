// Claude Code exports no plugin variable to a monitor process
// (docs/rules/plugin-monitors-command-env.md). It substitutes
// `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the command, so a bare
// `$CLAUDE_PLUGIN_ROOT` reads an unset variable. The rule reports each such
// variable in a monitor command. It makes no report when it cannot see the
// plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'

const name = 'plugin-monitors-command-env' as const

// A bare variable: the path variables, and a plugin option of any key. The
// lookahead keeps `$CLAUDE_PLUGIN_ROOT_DIR` out of the first alternative.
const BARE = /\$(CLAUDE_PLUGIN_(?:ROOT|DATA)(?![A-Za-z0-9_])|CLAUDE_PLUGIN_OPTION_[A-Za-z0-9_]+)/g

const rule: JSONRuleDefinition<{ MessageIds: 'pathVariable' | 'option' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the plugin path variables of a monitor command in the braced form',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      pathVariable:
        'Claude Code does not export `{{bare}}` to a monitor process. Write `{{braced}}`, which Claude Code substitutes in the command.',
      option:
        'Claude Code does not export `{{bare}}` to a monitor process. A monitor cannot read a plugin option. Have the monitor script read the value from a config file.',
    },
  },
  create(context) {
    const file = pluginFileOf(context.filename)
    return {
      Document(node) {
        if (file === undefined) {
          return
        }
        for (const { kind, node: command } of commandsOf(file.role, node, file.plugin)) {
          if (kind !== 'monitor') {
            continue
          }
          const variables = new Set(
            Array.from(command.value.matchAll(BARE), (match) => match[1] as string),
          )
          for (const variable of variables) {
            context.report({
              node: command,
              messageId: variable.startsWith('CLAUDE_PLUGIN_OPTION_') ? 'option' : 'pathVariable',
              data: { bare: `$${variable}`, braced: `\${${variable}}` },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json'],
  rule,
}
