// An agent mock of an eval suite saves its answers in the results of a run.
// The author copies them into `mocks/.replay/`, and commits that directory, so
// that runs in CI repeat (docs/rules/plugin-evals-replay-committed.md). The
// rule lints the manifest of a plugin that has an eval directory. It reports a
// `.gitignore` pattern that covers `mocks/.replay/`. It also reports a
// `mocks/.replay/` that holds a file on the disk, when git tracks none below it.
// Git cannot track an empty directory, so a directory with no file is silent.
// Both answers come from `src/git-state.ts`. The rule makes no report when git
// cannot answer.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitIgnores, gitTracksBelow } from '../git-state.ts'
import { evalDirectoryOf, holdsFile } from '../plugin-evals.ts'

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
        // A saved answer sits in `.replay/<server>/`. The docs do not name the files. The probe has
        // no extension, so it matches a pattern for a directory or for any file. Its names are
        // unlikely, so that a pattern for another purpose, such as `server/`, does not match.
        const ignored = gitIgnores(suite.bound, path.join(replay, 'probe-server', 'probe-answer'))
        const data = { dir: suite.name }
        if (ignored === true) {
          context.report({ node, messageId: 'ignored', data })
        } else if (
          // Git refuses a path behind a link, so `ignored` is `UNREADABLE` for a linked directory.
          ignored === false &&
          holdsFile(replay) &&
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
