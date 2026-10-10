// The hooks guide shows each hook script with a `#!/bin/bash` first line, and says that hook scripts must be
// executable (docs/rules/hooks-script-shebang.md). A script that a hook runs directly needs a shebang to name its
// interpreter. The docs do not state this, so the rule is a practice check. It reads the first line of a
// repository script that `${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}` names, and reports nothing for a
// file that it cannot read inside the repository (ADR 001, Decision 14).
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  argsOf,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  stringOf,
} from '../hooks-config.ts'
import { placeholderFolders, scriptsRun, scriptText } from '../hooks-files.ts'

const name = 'hooks-script-shebang' as const

/** A script of a system that has no shebang line. */
const OTHER_SYSTEM = /\.(?:ps1|bat|cmd)$/i

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Start a hook script that runs directly with a shebang line',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shebang:
        'The script "{{script}}" starts with no "#!" line, and this hook runs it directly. Start the file with a shebang line such as "#!/bin/bash".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { handler } of handlersOf(source)) {
        const line = memberOf(handler, 'command')?.value
        const argv = argsOf(handler)
        // The docs say `shell` is ignored when `args` is set.
        if (
          stringOf(handler, 'type') !== 'command' ||
          line?.kind !== 'string' ||
          (stringOf(handler, 'shell') === 'powershell' && argv === undefined)
        ) {
          continue
        }
        for (const script of scriptsRun(line.value, argv, folders, false)) {
          const text = OTHER_SYSTEM.test(script.file) ? undefined : scriptText(script)
          // A binary file is a program that needs no shebang.
          if (text !== undefined && !text.startsWith('#!') && !text.includes('\0')) {
            context.report({
              loc: line.loc,
              messageId: 'shebang',
              data: { script: path.basename(script.file) },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
