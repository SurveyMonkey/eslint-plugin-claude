// A `commands` path in a manifest can name a directory with no command in it.
// Claude Code then writes a warning in the debug log, and nothing in the session
// (docs/rules/plugin-commands-dir-nonempty.md). The rule reports such a path.
// A command is a `.md` file at any depth, which includes a `SKILL.md` in a
// subdirectory. The rule makes no report when it cannot read the directory,
// or when a `.md` link in it has no target.

import { statSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { locate, pathNodes, readPlugin } from '../plugin-manifest.ts'
import { entriesOf, markdownFiles, realOf, SKIPPED } from '../skill-tree.ts'

const name = 'plugin-commands-dir-nonempty' as const

/** True when a `.md` link in `dir` or below has no target. The walk is the one
 *  of `markdownFiles`: it follows a link to a folder once, and skips `.git` and
 *  `node_modules`. `seen` holds the real paths of the folders that it entered.
 *  The scan has set `outside` for a link out of the repository, so the rule has
 *  made no report before it calls this function. */
function hasBrokenMarkdownLink(dir: string, seen: Set<string>): boolean {
  const entries = entriesOf(dir)
  return (
    Array.isArray(entries) &&
    entries
      .filter((entry) => !SKIPPED.has(entry.name))
      .some((entry) => {
        const full = path.join(dir, entry.name)
        if (!entry.isSymbolicLink()) {
          return entry.isDirectory() && hasBrokenMarkdownLink(full, seen)
        }
        const target = realOf(full)
        if (target === null) {
          return entry.name.endsWith('.md')
        }
        if (typeof target !== 'string' || seen.has(target)) {
          return false
        }
        seen.add(target)
        return statSync(target).isDirectory() && hasBrokenMarkdownLink(full, seen)
      })
  )
}

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
          if (
            !scan.unreadable &&
            !scan.outside &&
            scan.files.length === 0 &&
            !hasBrokenMarkdownLink(real, new Set([real]))
          ) {
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
