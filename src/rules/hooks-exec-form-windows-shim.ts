// On Windows, exec form needs `command` to resolve to a real executable. The `.cmd` and `.bat` shims that npm,
// npx, eslint and other tools install are no executables, so the spawn fails
// (docs/rules/hooks-exec-form-windows-shim.md). The platform of a team is not in a file. So the rule takes the
// option `platforms`, and makes no report unless a Windows value is in it.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  PLATFORMS_SCHEMA,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-exec-form-windows-shim' as const

/** The tools that npm and its relatives install as `.cmd` shims on Windows. The docs name `npm`, `npx` and
 *  `eslint`, and say "other tools". The other names are the choice of the plugin. */
const SHIMS = ['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'eslint', 'prettier', 'tsc']

interface Options {
  platforms?: string[]
}

/** True when the executable `command` is a shim on Windows. */
function isShim(command: string): boolean {
  return (
    SHIMS.includes(command) ||
    /\.(?:cmd|bat)$/i.test(command) ||
    /node_modules[\\/]\.bin[\\/]/.test(command)
  )
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not spawn an npm shim in exec form on Windows',
      url: docsUrl(name),
    },
    schema: [PLATFORMS_SCHEMA],
    defaultOptions: [{}],
    messages: {
      shim: 'On Windows, exec form spawns "{{command}}" directly, and an npm shim (.cmd or .bat) is no executable. Run the script with "node" and its path in "args", or use shell form.',
    },
  },
  create(context) {
    const [{ platforms = [] }] = context.options as [Options]
    if (!platforms.some((platform) => platform.startsWith('windows'))) {
      return {}
    }
    return hooksListener(context, (source) => {
      for (const { handler } of handlersOf(source)) {
        const executable = memberOf(handler, 'command')?.value
        if (
          stringOf(handler, 'type') === 'command' &&
          executable?.kind === 'string' &&
          memberOf(handler, 'args')?.value.kind === 'array' &&
          isShim(executable.value)
        ) {
          context.report({
            loc: executable.loc,
            messageId: 'shim',
            data: { command: executable.value },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
