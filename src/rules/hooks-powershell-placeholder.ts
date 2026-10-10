// A command hook with `shell: "powershell"` runs the `command` string in PowerShell. Claude Code
// rewrites `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` to the
// PowerShell form `${env:NAME}`. It does not rewrite the bare `$CLAUDE_PROJECT_DIR`, which
// PowerShell reads as an undefined variable. PowerShell expands no variable in single quotes
// (docs/rules/hooks-powershell-placeholder.md). `shell` is ignored in exec form, so the rule reads
// shell form only.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { HOOKS_TARGET, handlersOf, hooksListener, memberOf, stringOf } from '../hooks-config.ts'

const name = 'hooks-powershell-placeholder' as const

const BARE = /\$CLAUDE_PROJECT_DIR(?![A-Za-z0-9_])/
const PLACEHOLDER = /\$\{CLAUDE_(?:PROJECT_DIR|PLUGIN_ROOT|PLUGIN_DATA)\}/

/** The text of a PowerShell line, in two parts: `single` holds the text inside single quotes, and
 *  `other` holds the rest. In a single-quoted string `''` is one quote, and a backtick is a plain
 *  character. In a double-quoted string `""` is one quote. Outside a single-quoted string, a backtick
 *  escapes the next character. A string that is not closed runs to the end of the line. */
function split(line: string): { single: string; other: string } {
  let single = ''
  let other = ''
  let quote = ''
  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i)
    if (quote === "'") {
      if (char !== "'") {
        single += char
      } else if (line.charAt(i + 1) === "'") {
        single += char
        i++
      } else {
        quote = ''
        single += '\n'
      }
    } else if (char === '`') {
      // The escaped character is not a variable or a quote.
      other += ' '
      i++
    } else if (quote === '"') {
      if (char === '"' && line.charAt(i + 1) === '"') {
        i++
      } else if (char === '"') {
        quote = ''
      } else {
        other += char
      }
    } else if (char === "'" || char === '"') {
      quote = char
    } else {
      other += char
    }
  }
  return { single, other }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write a path placeholder of a PowerShell hook in a form that PowerShell expands',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bare: `PowerShell reads "$CLAUDE_PROJECT_DIR" as an undefined variable, and it gives $null. Write "\${CLAUDE_PROJECT_DIR}" or "$env:CLAUDE_PROJECT_DIR".`,
      quoted:
        'PowerShell does not expand "{{placeholder}}" inside single quotes. Use double quotes.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        if (
          stringOf(handler, 'type') !== 'command' ||
          stringOf(handler, 'shell') !== 'powershell' ||
          line?.kind !== 'string' ||
          memberOf(handler, 'args')?.value.kind === 'array'
        ) {
          continue
        }
        const { single, other } = split(line.value)
        if (BARE.test(other)) {
          context.report({ loc: line.loc, messageId: 'bare' })
        }
        const placeholder = PLACEHOLDER.exec(single)?.[0]
        if (placeholder !== undefined) {
          context.report({ loc: line.loc, messageId: 'quoted', data: { placeholder } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
