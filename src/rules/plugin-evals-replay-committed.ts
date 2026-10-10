// An agent mock of an eval suite saves its answers in the results of a run.
// The author copies them into `mocks/.replay/`, and commits that directory, so
// that runs in CI repeat (docs/rules/plugin-evals-replay-committed.md). The
// rule lints the manifest of a plugin that has an eval directory. It reports a
// `.gitignore` pattern that covers `mocks/.replay/`. It also reports a
// `mocks/.replay/` that has files, when git tracks none of them. Both answers
// come from `src/git-state.ts`. The rule makes no report when git cannot
// answer.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitIgnores, gitTracksBelow } from '../git-state.ts'
import { evalDirectoryOf } from '../plugin-evals.ts'
import { entriesOf } from '../skill-tree.ts'

const name = 'plugin-evals-replay-committed' as const

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' | 'untracked' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Commit the mocks/.replay directory of an eval suite, and do not ignore it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'A ".gitignore" pattern covers "{{dir}}/mocks/.replay/". Commit it with the rest of "mocks/", so that runs in CI repeat. Remove the pattern.',
      untracked:
        'Git tracks no file in "{{dir}}/mocks/.replay/". Commit it with the rest of "mocks/", so that runs in CI repeat.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const suite = evalDirectoryOf(context.filename, node)
        if (suite === null) {
          return
        }
        const replay = path.join(suite.real, 'mocks', '.replay')
        // A recording sits in `.replay/<server>/`. The names have no extension, so a pattern for
        // files does not cover them.
        const ignored = gitIgnores(suite.bound, path.join(replay, 'server', 'recording'))
        const data = { dir: suite.name }
        // Git refuses a path behind a link, so `ignored` is `UNREADABLE` for a linked directory.
        const entries = ignored === false ? entriesOf(replay) : null
        if (ignored === true) {
          context.report({ node, messageId: 'ignored', data })
        } else if (
          Array.isArray(entries) &&
          entries.length > 0 &&
          gitTracksBelow(suite.bound, replay) === false
        ) {
          context.report({ node, messageId: 'untracked', data })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}
