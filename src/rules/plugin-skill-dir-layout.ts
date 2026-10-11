// A skills directory that the `skills` key of a manifest names holds one folder
// for each skill, with a `SKILL.md` in it (docs/rules/plugin-skill-dir-layout.md).
// The rule reports a loose `.md` file in such a directory. The default
// `skills/` directory is for `skill-file-layout`, so the rule skips it.
import { type Dirent, statSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { locate, pathNodes, readPlugin } from '../plugin-manifest.ts'
import { entriesOf, isInside, realOf } from '../skill-tree.ts'
import { isSkillsDir } from './skill-file-layout.ts'

const name = 'plugin-skill-dir-layout' as const

/** True when the entry is a file that the rule can see. A link counts when its
 *  target is a file in the repository. A link to a folder is not a file. The
 *  rule cannot see another link. */
function isLooseFile(entry: Dirent, dir: string, bound: string): boolean {
  if (!entry.isSymbolicLink()) {
    return !entry.isDirectory()
  }
  const target = realOf(path.join(dir, entry.name))
  return typeof target === 'string' && isInside(target, bound) && !statSync(target).isDirectory()
}

const rule: JSONRuleDefinition<{ MessageIds: 'loose' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put each skill of a listed skills directory in a folder with a SKILL.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      loose:
        '`{{file}}` is a loose file in the skills directory `{{dir}}`. Claude Code does not find it. Move it to `{{stem}}/SKILL.md`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // The plugin root and the default directory are the same text for the shipped rule.
        const skipped = new Set([plugin.root, path.join(plugin.root, 'skills')])
        for (const entry of pathNodes(lastMember(node.body, 'skills')?.value)) {
          const real = skipped.has(path.resolve(plugin.root, entry.value))
            ? undefined
            : locate(plugin, entry.value)
          // A real path that is a default skills directory is for `skill-file-layout`, as a link to it is.
          if (typeof real !== 'string' || isSkillsDir(real)) {
            continue
          }
          const entries = entriesOf(real)
          // A folder that holds its own `SKILL.md` is one skill. Its other files are supporting files.
          if (!Array.isArray(entries) || entries.some((e) => e.name === 'SKILL.md')) {
            continue
          }
          // In `skills/<name>/`, `skill-file-layout` reports a `skill.md` of the wrong letter case.
          const shipped = isSkillsDir(path.dirname(real))
          const loose = entries
            .filter((e) => e.name.endsWith('.md') && isLooseFile(e, real, plugin.bound))
            .filter((e) => e.name.toLowerCase() !== 'readme.md')
            .filter((e) => !(shipped && e.name.toLowerCase() === 'skill.md'))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b, 'en'))
          for (const file of loose) {
            const data = { file, dir: entry.value, stem: path.basename(file, '.md') }
            context.report({ node: entry, messageId: 'loose', data })
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
