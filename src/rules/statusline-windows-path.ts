// A Windows path with backslashes in the `statusLine` `command` (docs/rules/statusline-windows-path.md).
// The statusline page says that Git Bash treats an unquoted backslash as an escape character. So a
// path such as `C:\Users\me\status.mjs` reaches the script with its separators removed. The rule
// reads the command as text and tracks the quotes of a shell. It reads no word of the command, so
// it is not a second reader of the command that `statusline-script-exists` checks.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'statusline-windows-path' as const

// The characters of a path name on each side of a separator. A drive letter ends in `:`.
const BEFORE = /[\w.:~-]/
const AFTER = /[\w.~-]/

/** True when `command` has a backslash between two path characters outside quotes. A backslash
 *  that escapes another character is not a path separator: `\\`, `\ ` and `\"`. Single quotes
 *  and double quotes keep a backslash before a letter, so the scan skips them. */
function hasBackslashPath(command: string): boolean {
  let quote = ''
  for (let at = 0; at < command.length; at += 1) {
    const char = command.charAt(at)
    if (quote === "'") {
      quote = char === "'" ? '' : quote
    } else if (char === '\\') {
      if (
        quote === '' &&
        BEFORE.test(command.charAt(at - 1)) &&
        AFTER.test(command.charAt(at + 1))
      ) {
        return true
      }
      // The next character is escaped. In double quotes it can be the quote that ends the string.
      at += 1
    } else if (quote === '"') {
      quote = char === '"' ? '' : quote
    } else if (char === "'" || char === '"') {
      quote = char
    }
  }
  return false
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'backslash' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a path in the statusLine command with forward slashes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      backslash:
        'The statusLine command has a path with backslashes. Git Bash on Windows treats an unquoted backslash as an escape character, and the command fails. Write the path with forward slashes.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const command = lastMember(lastMember(node.body, 'statusLine')?.value, 'command')?.value
        if (command?.type === 'String' && hasBackslashPath(command.value)) {
          context.report({ node: command, messageId: 'backslash' })
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
