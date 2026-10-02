// In one scope, each skill and command file has its own command name
// (docs/rules/skill-name-unique.md). A scope is a `.claude/` directory or a plugin.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readManifest,
  repositoryRoot,
  scopeRoot,
  skillFiles,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'skill-name-unique' as const

/** The name without the differences that Claude Code ignores for a synced
 *  skill. These are case, spacing, invisible characters, compatibility forms
 *  such as fullwidth letters, and dash variants. The rule applies this to all
 *  names. */
function fold(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u{2010}-\u{2015}\u{2212}]/gu, '-')
    .replace(/[\p{Cf}\p{Cc}\p{Z}]/gu, '')
}

/** The name from the field `name`, or the folder when the field is not a
 *  non-empty string. */
function skillName(fields: Record<string, unknown> | null, folder: string): string {
  const given = fields?.name
  return typeof given === 'string' && given !== '' ? given : folder
}

interface Entry {
  file: string
  name: string
}

/** True when the plugin at `root` sets `commands`, so that Claude Code reads
 *  the key instead of `commands/`. A manifest that the rule cannot see can
 *  set the key. Such a manifest is unreadable, or out of the repository. The
 *  result is true for such a manifest, so the rule reads no `commands/`
 *  folder. */
function setsCommands(root: string, bound: string): boolean {
  const manifest = readManifest(root, bound)
  return manifest === UNREADABLE || (manifest !== null && 'commands' in manifest)
}

/** The command name of each skill and command file in the scope at `root`,
 *  read from disk at or below `bound`. The plugin-root `SKILL.md` has no
 *  entry. */
function scopeEntries(root: string, bound: string): Entry[] {
  const skillsDir = path.join(root, 'skills')
  // A skill file that the rule cannot read has no name to compare.
  const skills = skillFiles(skillsDir, bound).flatMap((file) => {
    const fields = frontmatterOfFile(file)
    return fields === UNREADABLE
      ? []
      : [{ file, name: skillName(fields, path.basename(path.dirname(file))) }]
  })
  const commandsDir = path.join(root, 'commands')
  // A `commands/` folder that the scan cannot read gives fewer entries. That can only hide a
  // duplicate, never add one, so the rule ignores `unreadable` here.
  const commands = (setsCommands(root, bound) ? [] : markdownFiles(commandsDir, bound).files).map(
    (file) => ({
      file,
      name: path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep).join(':'),
    }),
  )
  return [...skills, ...commands]
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each skill and command in one scope its own name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        '`{{name}}` is also the command name of {{others}}. Claude Code gives that name to only one of them. Rename one.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // The plugin-root skill has no name from a folder or a path.
    if (file === null || file.names.length === 0) {
      return {}
    }
    const self = path.resolve(context.filename)
    const root = scopeRoot(self, file)
    const bound = repositoryRoot(file.plugin ? root : path.dirname(root))
    // A file in `commands/` is not a command when the key replaces the folder.
    if (file.kind === 'command' && setsCommands(root, bound)) {
      return {}
    }
    return {
      root(node) {
        let given: Record<string, unknown> | null = null
        let loc: ReturnType<SkillFrontmatter['at']> = {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 1 },
        }
        const first = node.children[0]
        if (first?.type === 'yaml' && file.kind === 'skill') {
          const fm = readFrontmatter(context.sourceCode, first)
          if (fm === null) {
            return
          }
          given = fm.data
          if (typeof fm.data.name === 'string' && fm.data.name !== '') {
            const field = fm.fields.get('name')
            // A key that is an alias has a value but no field.
            if (field !== undefined) {
              loc = fm.at(field.valueStart, field.valueEnd)
            }
          }
        }
        const own =
          file.kind === 'skill' ? skillName(given, file.names[0] as string) : file.names.join(':')
        const others = scopeEntries(root, bound).filter(
          (entry) => entry.file !== self && fold(entry.name) === fold(own),
        )
        if (others.length > 0) {
          context.report({
            loc,
            messageId: 'duplicate',
            data: {
              name: own,
              others: others
                .map((entry) => `\`${path.relative(root, entry.file).split(path.sep).join('/')}\``)
                .join(', '),
            },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}
