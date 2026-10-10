// A `.claude/settings.local.json` below the repository root
// (docs/rules/settings-local-location.md). Claude Code before v2.1.211 kept the local file in the
// directory where the session started. Current versions keep it at the repository root, and still
// read the older file. The rule reads no file. It finds the repository root through
// `repositoryRoot`, which walks up from the project to the first `.git` and no further. Without a
// `.git` the project is its own root, so the rule makes no report.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { realDirectory, repositoryRoot } from '../skill-tree.ts'

const name = 'settings-local-location' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'leftover' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep .claude/settings.local.json at the repository root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      leftover:
        'Claude Code keeps the local settings file at the repository root since v2.1.211. It still reads this file, which an earlier version left here. Move the settings to the root file.',
    },
  },
  create(context) {
    // The project directory holds `.claude/`.
    const project = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        if (realDirectory(project) !== repositoryRoot(project)) {
          context.report({ node: node.body, messageId: 'leftover' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.local.json'],
  rule,
}
