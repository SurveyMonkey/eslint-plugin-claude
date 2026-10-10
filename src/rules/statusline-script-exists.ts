// The script of a status line, a subagent status line or a file suggestion
// command must exist (docs/rules/statusline-script-exists.md). The script that
// is the program must also have the executable bit. The bit is the git index
// mode `100755`, read by `src/git-state.ts`. The rule makes no report in three
// cases: a path that it cannot see, a script that git does not track, and a
// git index that it cannot read.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitModeOf, PLAIN_MODE } from '../git-state.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { realScript, scriptRefs, settingsScope, wordsOf } from '../script-refs.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'statusline-script-exists' as const

// The settings keys that hold a `command`.
const KEYS = ['statusLine', 'subagentStatusLine', 'fileSuggestion']

const rule: JSONRuleDefinition<{ MessageIds: 'missing' | 'notExecutable' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a status line script that exists and is executable',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The {{key}} script "{{path}}" does not exist in the repository, so the command fails.',
      notExecutable:
        'The {{key}} script "{{path}}" has git mode 100644, not 100755. The script must be executable, or the command fails. Run "git update-index --chmod=+x" on it.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const scope = settingsScope(context.filename)
    return {
      Document(node) {
        for (const key of KEYS) {
          const command = lastMember(lastMember(node.body, key)?.value, 'command')?.value
          if (command?.type !== 'String') {
            continue
          }
          const words = wordsOf(command.value).map((text) => ({ text, node: command }))
          for (const ref of scriptRefs(words, scope)) {
            const real = realScript(ref.file, scope)
            const data = { key, path: ref.word }
            if (real === null) {
              context.report({ node: ref.node, messageId: 'missing', data })
            } else if (
              ref.first &&
              typeof real === 'string' &&
              gitModeOf(scope.bound, real) === PLAIN_MODE
            ) {
              context.report({ node: ref.node, messageId: 'notExecutable', data })
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
