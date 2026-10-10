// A monitor command runs in a shell. Claude Code puts the path of the plugin into it as plain
// text, so an install path with a space splits into words unless the variable sits inside quotes
// (docs/rules/plugin-monitors-command-quote.md). `claude plugin validate` reports an unquoted
// variable in `hooks/hooks.json` only, so this rule reads the monitor commands. It makes no
// report when it cannot see the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'

const name = 'plugin-monitors-command-quote' as const

// Escaped, so that the template literal keeps each variable as text.
const VARIABLES = [`\${CLAUDE_PLUGIN_ROOT}`, `\${CLAUDE_PLUGIN_DATA}`]

/** The variables in `line` that sit outside quotes, in order of first use, each once. A single
 *  quote and a double quote both count as quotes. A backslash outside single quotes escapes the
 *  next character. A line with a command substitution gives none, because quotes nest inside
 *  it. A quote that never closes holds the rest of the line. */
function unquoted(line: string): string[] {
  if (line.includes('$(') || line.includes('`')) {
    return []
  }
  const found = new Set<string>()
  let quote: string | undefined
  for (let at = 0; at < line.length; at++) {
    const char = line.charAt(at)
    if (quote === "'") {
      quote = char === "'" ? undefined : quote
    } else if (char === '\\') {
      at++
    } else if (char === '"' || (char === "'" && quote === undefined)) {
      quote = quote === undefined ? char : undefined
    } else if (quote === undefined) {
      const variable = VARIABLES.find((text) => line.startsWith(text, at))
      if (variable !== undefined) {
        found.add(variable)
        at += variable.length - 1
      }
    }
  }
  return [...found]
}

const rule: JSONRuleDefinition<{ MessageIds: 'unquoted' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put the path variables of a monitor command inside quotes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unquoted:
        'The monitor command uses `{{variable}}` outside quotes. An install path with a space splits into several words. Wrap the variable in double quotes.',
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
          for (const variable of unquoted(command.value)) {
            context.report({ node: command, messageId: 'unquoted', data: { variable } })
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
