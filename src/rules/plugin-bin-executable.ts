// Each file directly in the `bin/` of a plugin must have the executable bit
// (docs/rules/plugin-bin-executable.md). The bit is the git index mode `100755`,
// read by `src/git-state.ts`. A `bin/` file is not a JSON file, so the rule
// lints the manifest of the plugin and reports one file at a time. It makes no
// report for a file that git does not track, or when git cannot be read.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitChildren, PLAIN_MODE } from '../git-state.ts'
import { isPluginRoot } from '../plugin-root.ts'
import { isInside, realDirectory, realOf, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'plugin-bin-executable' as const

const rule: JSONRuleDefinition<{ MessageIds: 'notExecutable' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each file in the bin directory of a plugin the executable bit',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notExecutable:
        'The file "bin/{{file}}" has git mode 100644, not 100755. Claude Code puts "bin/" on the PATH of the Bash tool, and a file without the executable bit does not run as a command. Run "git update-index --chmod=+x" on it.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const root = realDirectory(path.dirname(path.dirname(path.resolve(context.filename))))
        if (isPluginRoot(root) !== true) {
          return
        }
        const bound = repositoryRoot(root)
        // A `bin` link to a directory of the repository is read where it leads.
        const bin = realOf(path.join(root, 'bin'))
        if (typeof bin !== 'string' || !isInside(bin, bound)) {
          return
        }
        const children = gitChildren(bound, bin)
        if (children === UNREADABLE) {
          return
        }
        // A hidden file, such as `.gitkeep`, is not a command.
        for (const [file, mode] of children) {
          if (mode === PLAIN_MODE && !file.startsWith('.')) {
            context.report({ node, messageId: 'notExecutable', data: { file } })
          }
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
