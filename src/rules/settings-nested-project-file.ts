// A `.claude/settings.json` below the repository root (docs/rules/settings-nested-project-file.md).
// A heuristic, and `off` in `recommended`. Claude Code reads the project settings of the directory
// where the session starts. It does not read the file of a parent directory. So a nested file
// applies only to a session that starts in its directory, and it must hold every setting that
// such a session needs. The rule reads no file. It finds the repository root through
// `repositoryRoot`, as `settings-local-location` does. Without a `.git` the project is its own
// root, so the rule makes no report.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isInside, realDirectory, repositoryRoot } from '../skill-tree.ts'

const name = 'settings-nested-project-file' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'nested' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep the shared project settings file at the repository root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      nested:
        'Claude Code reads this file only in a session that starts in "{{directory}}", and it does not fall back to the settings file of a parent directory. Keep in this file every setting that such a session needs, or move the shared settings to the file at the repository root.',
    },
  },
  create(context) {
    // The project directory holds `.claude/`.
    const project = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const root = repositoryRoot(project)
        const here = realDirectory(project)
        // A project that is a link out of the repository is not in the repository.
        if (here !== root && isInside(here, root)) {
          const directory = path.relative(root, here).split(path.sep).join('/')
          context.report({ node: node.body, messageId: 'nested', data: { directory } })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}
