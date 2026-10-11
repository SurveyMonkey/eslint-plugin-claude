// An `excludedCommands` entry that matches every command, or a shell or an interpreter with any
// arguments (docs/rules/sandbox-excluded-commands-broad.md). An excluded command runs with full
// access, and "exclusion is a convenience, not a security boundary"
// (https://code.claude.com/docs/en/settings-reference#sandbox-excludedcommands). The entries that
// the docs give (`docker *`, `docker compose *`, `gh *`, `open *`, `git *`) are not broad here.
// `sandbox-excluded-commands-syntax` owns the `Bash(...)` wrapper and the first words that Claude
// Code keeps sandboxed. None of those words is in the list below, and a wrapper is not a word of
// the list, so the two rules never report one entry.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-excluded-commands-broad' as const

type MessageId = 'everything' | 'interpreter'

/** The shells and interpreters. The docs warn about "a pattern that covers an interpreter", but
 *  they name none for `excludedCommands`. The whole list is the choice of the plugin. */
const INTERPRETERS = [
  'sh',
  'bash',
  'zsh',
  'dash',
  'ksh',
  'fish',
  'python',
  'python3',
  'node',
  'deno',
  'bun',
  'ruby',
  'perl',
  'php',
]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not exclude every command, or a whole shell or interpreter, from the sandbox',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      everything:
        '`{{entry}}` matches every command, so no command runs in the sandbox. An excluded command runs with your full access. List the tools that need it, such as `docker compose *`, or use "filesystem.allowWrite" for a tool that needs one path.',
      interpreter:
        '`{{entry}}` takes `{{word}}` out of the sandbox with any arguments, so Claude can write a script and run it with your full access. Exclusion is not a security boundary. Name the one tool, or use "filesystem.allowWrite" for a path.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const entry of stringEntries(valueAt(node, ['sandbox', 'excludedCommands']))) {
          const text = entry.value.trim()
          const [word = '', ...rest] = commandWords(text)
          // Only a final wildcard makes the arguments free: `python3 -m pytest *` names a tool.
          if (word === '*' && rest.every((other) => other === '*')) {
            context.report({ node: entry, messageId: 'everything', data: { entry: text } })
          } else if (
            INTERPRETERS.includes(word) &&
            rest.includes('*') &&
            rest.every((other) => other === '*' || other.startsWith('-'))
          ) {
            context.report({ node: entry, messageId: 'interpreter', data: { entry: text, word } })
          }
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
