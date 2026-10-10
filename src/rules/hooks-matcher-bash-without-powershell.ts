// On Windows, Claude Code can run shell commands through the PowerShell tool and not register Bash
// at all, so a hook that matches `Bash` only never fires there
// (docs/rules/hooks-matcher-bash-without-powershell.md). The hooks reference says to match
// `Bash|PowerShell`.
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-bash-without-powershell' as const

/** True when Claude Code selects the tool `tool` with the matcher. An exact-match matcher is a list of
 *  names. Any other matcher is a regular expression that is tested on the name, and an invalid
 *  one selects nothing here: `hooks-matcher-syntax` reports it. */
function selects(matcher: string, tool: string): boolean {
  const exact = exactValues(matcher, false)
  if (exact !== null) {
    return exact.includes(tool)
  }
  try {
    return new RegExp(matcher).test(tool)
  } catch {
    return false
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Match PowerShell wherever a tool hook matches Bash',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bashOnly:
        'This matcher selects Bash and not PowerShell. On Windows, Claude Code can run shell commands through PowerShell, and this hook can fire on no Bash call there. Write "Bash|PowerShell".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        // An empty matcher selects every tool. `*` is no valid regular expression, so `selects` gives false
        // for it. This rule makes no report for either.
        if (
          matcher !== undefined &&
          TOOL_EVENTS.includes(event) &&
          selects(matcher.value, 'Bash') &&
          !selects(matcher.value, 'PowerShell')
        ) {
          context.report({ loc: matcher.loc, messageId: 'bashOnly' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
