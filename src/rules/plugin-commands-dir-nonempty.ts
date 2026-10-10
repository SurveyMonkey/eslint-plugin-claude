// A `commands` path in a manifest that names a directory with no command in it
// gives a warning in the debug log of Claude Code and nothing in the session
// (docs/rules/plugin-commands-dir-nonempty.md). The rule reports such a path.
// A command is a `.md` file at any depth, which includes a `SKILL.md` in a
// subdirectory. The rule makes no report when it cannot read the directory.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { locate, pathNodes, readPlugin } from '../plugin-manifest.ts'
import { entriesOf, markdownFiles } from '../skill-tree.ts'

const name = 'plugin-commands-dir-nonempty' as const

const rule: JSONRuleDefinition<{ MessageIds: 'empty' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a commands directory that holds at least one command',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      empty:
        'The `commands` path `{{path}}` holds no `.md` file and no subdirectory with a `SKILL.md`. Claude Code loads no command from it. Add command files, or remove the path.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const entry of pathNodes(lastMember(node.body, 'commands')?.value)) {
          const real = locate(plugin, entry.value)
          // A path to a file is a command file. `entriesOf` gives an array for a directory only.
          if (typeof real !== 'string' || !Array.isArray(entriesOf(real))) {
            continue
          }
          const scan = markdownFiles(real, plugin.bound)
          if (!scan.unreadable && !scan.outside && scan.files.length === 0) {
            context.report({ node: entry, messageId: 'empty', data: { path: entry.value } })
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
