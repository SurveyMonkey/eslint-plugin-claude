// Claude Code does not scan the `.claude/plugins/` directory of a project
// (docs/rules/plugin-no-project-plugins-dir.md). The rule reports the manifest
// of a plugin below that directory. It reads the spelling of the path, as the
// `files` glob does. It counts only the directories below the repository, so a
// repository that sits in a `.claude/plugins/` directory is not a report.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { type Plugin, readPlugin } from '../plugin-manifest.ts'
import { realDirectory } from '../skill-tree.ts'

const name = 'plugin-no-project-plugins-dir' as const

/** The directory names from the repository to the plugin root, as the path
 *  of the plugin spells them. The repository is the nearest directory, at or
 *  above the root, whose real path is the bound of the plugin. Without a `.git`,
 *  or when the root holds the `.git`, the result is one empty name. */
function partsBelowRepository(plugin: Plugin): string[] {
  let base = plugin.root
  while (realDirectory(base) !== plugin.bound) {
    base = path.dirname(base)
  }
  return path.relative(base, plugin.root).split(path.sep)
}

/** True when `parts` has `.claude`, then `plugins`, then at least one more
 *  directory name. */
function isInProjectPlugins(parts: string[]): boolean {
  return parts.some(
    (part, i) => part === '.claude' && parts[i + 1] === 'plugins' && i + 2 < parts.length,
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'projectPlugins' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a plugin out of the .claude/plugins/ directory of a project',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      projectPlugins:
        'This plugin is under `.claude/plugins/`. Claude Code does not scan that directory. A marketplace entry or `--plugin-dir` can still load it. Move it to `.claude/skills/<name>/`, or enable it through `enabledPlugins`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin !== undefined && isInProjectPlugins(partsBelowRepository(plugin))) {
          context.report({ node, messageId: 'projectPlugins' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/plugins/**/.claude-plugin/plugin.json'],
  rule,
}
