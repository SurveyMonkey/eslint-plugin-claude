// A `command` that runs a `.ps1` file needs `"shell": "powershell"` (docs/rules/hooks-ps1-needs-powershell-shell.md).
// The default shell of a command hook is Bash. It is PowerShell on Windows when Git Bash is not
// installed (the hooks reference, "Command hook fields"). Bash runs a `.ps1` file as a shell script, or
// refuses it. The rule cannot know the platform of a team, so it takes the option `platforms` and
// reports nothing without it (mid-round ruling 26). `shell` has no effect in exec form, so the rule
// reads shell form only.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  quotedList,
  stringOf,
} from '../hooks-config.ts'
import { commandsOf, commandWordAt } from '../shell-words.ts'

const name = 'hooks-ps1-needs-powershell-shell' as const

/** The platforms that the option names. Claude Code runs a hook in PowerShell by default on one of
 *  them: Windows without Git Bash. */
const PLATFORMS = ['windows-git-bash', 'windows-no-git-bash', 'macos', 'linux', 'wsl'] as const
const POWERSHELL_DEFAULT = 'windows-no-git-bash'

interface Options {
  platforms?: string[]
}

/** True when a simple command of `line` has a `.ps1` file as its command word. */
const runsScript = (line: string) =>
  commandsOf(line).some((words) => /\.ps1$/i.test(words[commandWordAt(words)] ?? ''))

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Set shell powershell on a hook command that runs a .ps1 file',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { enum: PLATFORMS }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      ps1: 'This command runs a .ps1 file with no "shell": "powershell". On {{platforms}} Claude Code runs the command in Bash, which cannot run a PowerShell script. Set "shell": "powershell".',
    },
  },
  create(context) {
    const [{ platforms = [] }] = context.options as [Options]
    const bash = platforms.filter((platform) => platform !== POWERSHELL_DEFAULT)
    if (bash.length === 0) {
      return {}
    }
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        if (
          stringOf(handler, 'type') === 'command' &&
          line?.kind === 'string' &&
          stringOf(handler, 'shell') !== 'powershell' &&
          memberOf(handler, 'args')?.value.kind !== 'array' &&
          runsScript(line.value)
        ) {
          context.report({ loc: line.loc, messageId: 'ps1', data: { platforms: quotedList(bash) } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
