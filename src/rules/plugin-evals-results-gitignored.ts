// `claude plugin eval` writes each run to `results/<timestamp>/` in the eval
// directory of the plugin. The docs tell the author to add `results/` to
// `.gitignore` (docs/rules/plugin-evals-results-gitignored.md). The rule lints
// the manifest of a plugin that has an eval directory. It asks
// `git check-ignore` (`src/git-state.ts`) about a path in `results/`. The rule
// makes no report when git cannot answer.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitIgnores } from '../git-state.ts'
import { evalDirectoryOf } from '../plugin-evals.ts'

const name = 'plugin-evals-results-gitignored' as const

const rule: JSONRuleDefinition<{ MessageIds: 'notIgnored' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Cover the results directory of an eval suite with a .gitignore pattern',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notIgnored:
        'No ".gitignore" pattern covers "{{dir}}/results/". Each run of "claude plugin eval" writes a directory there. Add "results/" to ".gitignore".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const suite = evalDirectoryOf(context.filename, node)
        if (suite === null) {
          return
        }
        // A run writes `results/<timestamp>/`. A directory in `results/` stands for it. The name
        // has no extension, so a pattern for files does not cover it.
        const run = path.join(suite.real, 'results', 'run')
        if (gitIgnores(suite.bound, run) === false) {
          context.report({ node, messageId: 'notIgnored', data: { dir: suite.name } })
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
