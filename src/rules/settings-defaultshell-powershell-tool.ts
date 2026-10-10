// `defaultShell: "powershell"` without the PowerShell tool
// (docs/rules/settings-defaultshell-powershell-tool.md). The settings reference says that
// `"powershell"` works only while the PowerShell tool is on, and that macOS, Linux and WSL need
// `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. Claude Code then falls back to Bash. The platform is a
// runtime fact, so the rule takes the option `platforms`. It makes no report without it. The variable can sit in the other file that Claude Code
// merges with the linted file, so the rule reads it too.
import type { JSONRuleDefinition } from '@eslint/json'
import { envIsOn, isEnvOn } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readSiblings } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-defaultshell-powershell-tool' as const

const VARIABLE = 'CLAUDE_CODE_USE_POWERSHELL_TOOL'

/** The platforms that the option names. */
const PLATFORMS = ['windows-git-bash', 'windows-no-git-bash', 'macos', 'linux', 'wsl'] as const
const WINDOWS = new Set<string>(['windows-git-bash', 'windows-no-git-bash'])

type Options = [{ platforms?: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'off' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Turn the PowerShell tool on where defaultShell is powershell',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { enum: [...PLATFORMS] }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      off: '"defaultShell" is "powershell", and "CLAUDE_CODE_USE_POWERSHELL_TOOL" is not "1" in the settings files. On {{platforms}} the PowerShell tool is off, so Claude Code runs "!" commands in Bash. Set the variable to "1" in "env".',
    },
  },
  create(context) {
    const [{ platforms = [] }] = context.options
    const others = platforms.filter((platform) => !WINDOWS.has(platform))
    if (others.length === 0 || isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const shell = lastMember(node.body, 'defaultShell')?.value
        if (shell?.type !== 'String' || shell.value !== 'powershell') {
          return
        }
        const env = lastMember(node.body, 'env')?.value
        const own = env?.type === 'Object' ? lastMember(env, VARIABLE)?.value : undefined
        if (own?.type === 'String' && isEnvOn(own.value)) {
          return
        }
        // A file that the rule cannot read can set the variable, so the rule stays silent.
        const siblings = readSiblings(context.filename)
        if (siblings === UNREADABLE || siblings.some((fields) => envIsOn(fields, VARIABLE))) {
          return
        }
        context.report({
          node: shell,
          messageId: 'off',
          data: { platforms: others.map((platform) => `"${platform}"`).join(', ') },
        })
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
