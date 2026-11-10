// PowerShell prints a `command` that is only quoted strings, and does not run it. A hook such as
// `"command": "\"C:\\Tools\\guard.exe\""` then starts no program, so a guard hook does not guard
// (docs/rules/hooks-powershell-quoted-program.md). That rule doc gives the fixes. The rule
// reads shell form only, because `shell` has no effect with `args`. With no `shell` key, the
// shell is PowerShell only on Windows with no Git Bash. So the rule then needs the option
// `platforms`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  PATH_VARIABLES,
  PLATFORMS_SCHEMA,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-powershell-quoted-program' as const

const POWERSHELL_DEFAULT = 'windows-no-git-bash'

interface Options {
  platforms?: string[]
}

/** The file types of a program path that the block "PowerShell started no program" names. */
const ENDING = /\.(?:exe|ps1|cmd|bat)$/i
/** A drive letter path, as in the docs example `C:\Tools\guard.exe`. */
const DRIVE = /^[A-Za-z]:[\\/]/
/** A path under `$HOME`, an `$env:` variable or a path placeholder. The block "PowerShell started
 *  no program" names `$HOME` and `$env:`. "Reference scripts by path in PowerShell hooks" names
 *  the three placeholders. That block also says that a placeholder works in double quotes only.
 *  PowerShell expands no variable in single quotes. So this form applies to a double-quoted string
 *  only. */
const ROOT = new RegExp(`^(?:\\$HOME|\\$env:\\w+|\\$\\{(?:${PATH_VARIABLES.join('|')})\\})[\\\\/]`)

/** One PowerShell quoted string: its quote character and its value. */
interface Quoted {
  quote: string
  value: string
}

/** True when a quoted string has a form of a program path that the docs show. */
const isProgramPath = ({ quote, value }: Quoted) =>
  ENDING.test(value) || DRIVE.test(value) || (quote === '"' && ROOT.test(value))

/** The quoted strings of `line`, when `line` holds only PowerShell quoted strings with white
 *  space between them. Else undefined. In a single-quoted string `''` is one quote. In a
 *  double-quoted string `""` is one quote. There, a backtick and the next character give that
 *  character. The rule does not read escapes such as `` `n ``. A string with no end quote, or
 *  text next to an end quote, gives undefined. */
function quotedStrings(line: string): Quoted[] | undefined {
  const strings: Quoted[] = []
  let i = 0
  for (;;) {
    while (/\s/.test(line.charAt(i))) {
      i++
    }
    if (i >= line.length) {
      return strings.length > 0 ? strings : undefined
    }
    const quote = line.charAt(i)
    if (quote !== '"' && quote !== "'") {
      return undefined
    }
    let value = ''
    for (i++; ; i++) {
      if (i >= line.length) {
        return undefined
      }
      const char = line.charAt(i)
      if (quote === '"' && char === '`') {
        value += line.charAt(i + 1)
        i++
      } else if (char === quote && line.charAt(i + 1) === quote) {
        value += quote
        i++
      } else if (char === quote) {
        break
      } else {
        value += char
      }
    }
    i++
    if (i < line.length && !/\s/.test(line.charAt(i))) {
      return undefined
    }
    strings.push({ quote, value })
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put & before the quoted program path of a PowerShell hook command',
      url: docsUrl(name),
    },
    schema: [PLATFORMS_SCHEMA],
    defaultOptions: [{}],
    messages: {
      quoted:
        'PowerShell prints a command that is only quoted strings, and starts no program. Put "&" before the quoted path to run "{{path}}".',
      unset:
        'On "windows-no-git-bash" this command runs in PowerShell, which prints a command that is only quoted strings and starts no program. Set "shell": "powershell", and put "&" before the quoted path to run "{{path}}".',
    },
  },
  create(context) {
    const [{ platforms = [] }] = context.options as [Options]
    const byDefault = platforms.includes(POWERSHELL_DEFAULT)
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        const shell = memberOf(handler, 'shell')
        const messageId =
          stringOf(handler, 'shell') === 'powershell'
            ? 'quoted'
            : shell === undefined && byDefault
              ? 'unset'
              : undefined
        if (
          messageId === undefined ||
          stringOf(handler, 'type') !== 'command' ||
          line?.kind !== 'string' ||
          memberOf(handler, 'args')?.value.kind === 'array'
        ) {
          continue
        }
        const first = quotedStrings(line.value)?.[0]
        if (first !== undefined && isProgramPath(first)) {
          context.report({ loc: line.loc, messageId, data: { path: first.value } })
        }
      }
    })
  },
}

export const target = { name, ...HOOKS_TARGET }

export default rule
