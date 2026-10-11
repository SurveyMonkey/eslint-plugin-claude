// Claude Code refuses to run a shell-form hook, a monitor or an MCP
// `headersHelper` whose command references `${user_config.*}`
// (docs/rules/plugin-user-config-no-shell-fields.md). The rule reports such a
// command in the manifest and in the default hooks, MCP and monitors files of a
// plugin. It makes no report when it cannot see the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'

const name = 'plugin-user-config-no-shell-fields' as const

const USER_CONFIG = /\$\{user_config\./

// Escaped, so that the template literal keeps the reference as text.
const REF = `\${user_config.*}`

const rule: JSONRuleDefinition<{ MessageIds: 'hook' | 'monitor' | 'headersHelper' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: `Keep ${REF} out of the fields that a shell runs`,
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      hook: `This shell-form hook \`command\` references \`${REF}\`. Claude Code fails the hook and does not run it. Set \`args\` to run it in exec form, or read \`CLAUDE_PLUGIN_OPTION_<KEY>\` in the script.`,
      monitor: `A monitor \`command\` cannot reference \`${REF}\`. Claude Code does not start the monitor. Have the monitor script read the value from a config file.`,
      headersHelper: `An MCP \`headersHelper\` cannot reference \`${REF}\`. Claude Code reports the server as misconfigured. Put the reference in \`headers\`, or read the value in the helper script.`,
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
          if (USER_CONFIG.test(command.value)) {
            context.report({ node: command, messageId: kind })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [
    '**/.claude-plugin/plugin.json',
    '**/hooks/hooks.json',
    '**/.mcp.json',
    '**/monitors/monitors.json',
  ],
  rule,
}
