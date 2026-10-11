// `${CLAUDE_PLUGIN_ROOT}` is the install directory of one plugin version. The path changes when the
// plugin updates, so state written there is lost (docs/rules/plugin-no-state-in-plugin-root.md).
// The rule reads each shell command of a plugin, and each script of the plugin that the command
// runs. It reports the first write under the root: a redirect, `cp` or `mv` to the root, `tee`,
// `touch` and `mkdir` on a path in the root, and a package install in the root. It is a heuristic.
// It makes no report for a script that it cannot read (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandsOf, pluginFileOf } from '../plugin-commands.ts'
import { pluginScripts } from '../plugin-scripts.ts'
import { subcommands, wordsOf } from '../shell-split.ts'

const name = 'plugin-no-state-in-plugin-root' as const

const ROOT_VARIABLE = String.raw`\$(?:\{CLAUDE_PLUGIN_ROOT\}|CLAUDE_PLUGIN_ROOT(?![A-Za-z0-9_]))`
const HAS_ROOT = new RegExp(ROOT_VARIABLE)
// A `>` or `>>` whose target starts with the variable. `>&` and `<` are not writes to a file.
const REDIRECT = new RegExp(String.raw`>>?\s*["']?${ROOT_VARIABLE}`)
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

// The programs that write to the last word, and to any path word.
const TO_LAST = new Set(['cp', 'mv'])
const TO_ANY = new Set(['tee', 'touch', 'mkdir'])
// The package managers and the words that install into the folder where they run.
const INSTALLERS: Readonly<Record<string, readonly string[]>> = {
  npm: ['install', 'i', 'ci'],
  yarn: ['install', 'add'],
  pnpm: ['install', 'i', 'add'],
  bun: ['install', 'i', 'add'],
}

/** The first write under the plugin root in the shell text `text`, as the words that name it, or
 *  undefined when the text has none. */
function firstWrite(text: string): string | undefined {
  // True after a `cd` to a path in the root, until the next `cd`.
  let inRoot = false
  for (const part of subcommands(text)) {
    if (REDIRECT.test(part)) {
      return 'a redirect'
    }
    const words = wordsOf(part)
    const at = words.findIndex((word) => !ASSIGNMENT.test(word) && word !== 'sudo')
    const program = path.posix.basename(words[at] ?? '')
    const args = words.slice(at + 1)
    const targets = args.filter((word) => !word.startsWith('-'))
    const install = INSTALLERS[program]?.find((word) => args.includes(word))
    if (program === 'cd') {
      inRoot = args.some((word) => HAS_ROOT.test(word))
    } else if (TO_LAST.has(program) && HAS_ROOT.test(targets.at(-1) ?? '')) {
      return `\`${program}\``
    } else if (TO_ANY.has(program) && targets.some((word) => HAS_ROOT.test(word))) {
      return `\`${program}\``
    } else if (install !== undefined && (inRoot || args.some((word) => HAS_ROOT.test(word)))) {
      return `\`${program} ${install}\``
    }
  }
  return undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'command' | 'script' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the state of a plugin to the plugin data folder, not to the plugin root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      command: `This command writes under \`\${CLAUDE_PLUGIN_ROOT}\` with {{action}}. The plugin root changes with each version, so Claude Code does not keep the write across an update. Write to \`\${CLAUDE_PLUGIN_DATA}\`, which survives updates.`,
      script: `The script "{{script}}" writes under \`\${CLAUDE_PLUGIN_ROOT}\` with {{action}}. The plugin root changes with each version, so Claude Code does not keep the write across an update. Write to \`\${CLAUDE_PLUGIN_DATA}\`, which survives updates.`,
    },
  },
  create(context) {
    const file = pluginFileOf(context.filename)
    return {
      Document(node) {
        if (file === undefined) {
          return
        }
        for (const { node: command } of commandsOf(file.role, node, file.plugin)) {
          const action = firstWrite(command.value)
          if (action !== undefined) {
            context.report({ node: command, messageId: 'command', data: { action } })
          }
          for (const script of pluginScripts(file.plugin, command.value)) {
            const written = firstWrite(script.text)
            if (written !== undefined) {
              const data = { action: written, script: script.word }
              context.report({ node: command, messageId: 'script', data })
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
  files: [
    '**/.claude-plugin/plugin.json',
    '**/hooks/hooks.json',
    '**/.mcp.json',
    '**/monitors/monitors.json',
  ],
  rule,
}
