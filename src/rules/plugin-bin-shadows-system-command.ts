// A file in `bin/` cannot shadow a system command: Claude Code puts the `bin/` of a plugin after
// the user's own `PATH` entries (docs/rules/plugin-bin-shadows-system-command.md). The docs name
// `git` and `ls`. The list of the rule is in `src/data/plugin-layout.ts`. The rule reports each
// file of `bin/` with the name of a listed command. It makes no report when it cannot see the
// plugin or `bin/`, and none for an entry that is a link with no target, a link that leaves the
// plugin, or no file.
import { Stats } from 'node:fs'
import type { JSONRuleDefinition } from '@eslint/json'
import { SYSTEM_COMMANDS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { lookup, readPlugin } from '../plugin-manifest.ts'
import { entriesOf, statOf } from '../skill-tree.ts'

const name = 'plugin-bin-shadows-system-command' as const

const rule: JSONRuleDefinition<{ MessageIds: 'shadows' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not name a bin file like a system command that the plugin cannot shadow',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shadows:
        'The file `bin/{{file}}` has the name of the system command "{{file}}". Claude Code puts the `bin/` of a plugin after the user\'s own `PATH` entries, so the plugin cannot shadow the command. Rename the file.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // A link to a folder out of the plugin, a link with no target, and a path that the rule
        // cannot read give no real path inside the plugin.
        const bin = lookup(plugin, 'bin')
        const entries = typeof bin === 'string' ? entriesOf(bin) : null
        if (!Array.isArray(entries)) {
          return
        }
        for (const { name: file } of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
          if (!SYSTEM_COMMANDS.includes(file)) {
            continue
          }
          const real = lookup(plugin, `bin/${file}`)
          const stat = typeof real === 'string' ? statOf(real) : null
          if (stat instanceof Stats && stat.isFile()) {
            context.report({ node, messageId: 'shadows', data: { file } })
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
