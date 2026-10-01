// A `SKILL.md` at the plugin root loads only when the plugin has no `skills/`
// directory and no `skills` manifest key (docs/rules/skill-plugin-root-shadowed.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readManifest, repositoryRoot, statOf, UNREADABLE } from '../skill-tree.ts'

const name = 'skill-plugin-root-shadowed' as const

/** True when `dir` is a directory. A path that is absent or that the rule
 *  cannot read gives false, and so no report. */
function isDirectory(dir: string): boolean {
  const stat = statOf(dir)
  return typeof stat === 'object' && stat !== null && stat.isDirectory()
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'directory' | 'manifest' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not put a SKILL.md at the root of a plugin that has other skills',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      directory:
        'This plugin has a `skills/` directory, so Claude Code does not load the `SKILL.md` at the plugin root. Move it to `skills/<name>/SKILL.md`.',
      manifest:
        '`plugin.json` sets `skills`, so Claude Code does not load the `SKILL.md` at the plugin root. Move it to a directory that the key lists.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // Only a plugin-root skill has no name from a folder or a path.
    if (file === null || file.names.length > 0) {
      return {}
    }
    const root = path.dirname(path.resolve(context.filename))
    const first = { line: 1, column: 1 }
    return {
      root() {
        if (isDirectory(path.join(root, 'skills'))) {
          context.report({ loc: first, messageId: 'directory' })
        }
        const manifest = readManifest(root, repositoryRoot(root))
        if (manifest !== null && manifest !== UNREADABLE && 'skills' in manifest) {
          context.report({ loc: first, messageId: 'manifest' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md'],
  rule,
}
