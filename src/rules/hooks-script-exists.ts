// A repository script that a hook command names must exist
// (docs/rules/hooks-script-exists.md). The rule reads `hooks/hooks.json` in a
// plugin, and the settings files. It makes no report for a path that it cannot
// see. Two examples are a link with no target and a path out of the repository.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { commandHandlers, handlerWords } from '../hook-handlers.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { hooksScope, realScript, scriptRefs } from '../script-refs.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'hooks-script-exists' as const

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a hook script that exists',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The hook script "{{path}}" does not exist in the repository. The hook cannot start, so Claude Code shows a non-blocking error and the hook never runs.',
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
          for (const ref of scriptRefs(handlerWords(handler), scope)) {
            if (realScript(ref.file, scope) === null) {
              context.report({ node: ref.node, messageId: 'missing', data: { path: ref.word } })
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
