// A repository script that is itself the hook command must have the executable
// bit (docs/rules/hooks-script-executable.md). The bit is the git index mode
// `100755`, read by `src/git-state.ts`. The rule makes no report for a path
// that it cannot see, for a script that git does not track, or when git cannot
// be read.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitModeOf, PLAIN_MODE } from '../git-state.ts'
import { commandHandlers, handlerWords } from '../hook-handlers.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { hooksScope, realScript, scriptRefs } from '../script-refs.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'hooks-script-executable' as const

const rule: JSONRuleDefinition<{ MessageIds: 'notExecutable' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give a hook script the executable bit',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notExecutable:
        'The hook script "{{path}}" has git mode 100644, not 100755. A hook script must be executable, so the hook fails with a non-blocking error. Run "git update-index --chmod=+x" on it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const scope = hooksScope(context.filename)
    return {
      Document(node) {
        if (scope === null) {
          return
        }
        for (const handler of commandHandlers(node)) {
          // Only the program needs the bit. `node run.js` runs `node`.
          for (const ref of scriptRefs(handlerWords(handler), scope).filter((r) => r.first)) {
            const real = realScript(ref.file, scope)
            if (typeof real === 'string' && gitModeOf(scope.bound, real) === PLAIN_MODE) {
              context.report({
                node: ref.node,
                messageId: 'notExecutable',
                data: { path: ref.word },
              })
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
  files: ['**/hooks/hooks.json', ...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
