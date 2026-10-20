// In one scope, each skill and command file has its own command name
// (docs/rules/skill-name-unique.md). A scope is a `.claude/` directory or a plugin.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'
import { escapeName, firstFault } from '../skill-names.ts'
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

/** The relative path of a file for a message. This function escapes each part
 *  of the path alone, and the file name without `.md`. A space is a fault at the
 *  edge of one name. */
function shownPath(relative: string): string {
  const parts = relative.split(path.sep)
  const last = parts.length - 1
  return parts
    .map((part, index) =>
      index === last && part.endsWith('.md')
        ? `${escapeName(part.slice(0, -3))}.md`
        : escapeName(part),
    )
    .join('/')
}

/** True when Claude Code refuses a part of a skill or command name. Claude Code does not
 *  use such a name, and `skill-name-characters` reports it. So the rule compares no such
 *  name. The check is for each part alone: a space at the edge of one part is a fault.
 *  A skill folder in a plugin is an exception: Claude Code loads it with hyphens in place
 *  of the refused characters. The rule does not compare that folder name either. */
function refused(parts: string[]): boolean {
  return parts.some((part) => firstFault(part) !== null)
}

/** The value of the field `name` when it is a non-empty string that Claude Code accepts,
 *  else null. Claude Code ignores a refused `name` and loads the skill under its folder. */
function loadedName(value: unknown): string | null {
  return typeof value === 'string' && value !== '' && firstFault(value) === null ? value : null
}

/** The name from the field `name`, or the folder when the field is not a
 *  loaded name. */
function skillName(fields: Record<string, unknown> | null, folder: string): string {
  return loadedName(fields?.name) ?? folder
}

interface Entry {
  file: string
  name: string
}

/** True when the plugin at `root` sets `commands`, so that Claude Code reads
 *  the key instead of `commands/`. A manifest that the rule cannot see can
 *  set the key. Such a manifest is unreadable, or out of the repository. The
 *  result is true for such a manifest, so the rule reads no `commands/`
 *  folder. A project `.claude/` is no plugin, so the result is false for it. */
function setsCommands(root: string, plugin: boolean, bound: string): boolean {
  // A project `.claude/` has no manifest. Only a plugin root has one.
  const manifest = plugin ? readManifest(root, bound) : null
  return manifest === UNREADABLE || (manifest !== null && 'commands' in manifest)
}

/** The command name of each skill and command file in the scope at `root`,
 *  read from disk at or below `bound`. The plugin-root `SKILL.md` has no
 *  entry. A skill or command with a refused folder or file name has no entry,
 *  unless the skill has a loaded `name`. */
function scopeEntries(root: string, plugin: boolean, bound: string): Entry[] {
  const skillsDir = path.join(root, 'skills')
  // A skill file that the rule cannot read has no name to compare.
  const skills = skillFiles(skillsDir, bound).flatMap((file) => {
    const fields = frontmatterOfFile(file)
    if (fields === UNREADABLE) {
      return []
    }
    const given = skillName(fields, path.basename(path.dirname(file)))
    return refused([given]) ? [] : [{ file, name: given }]
  })
  const commandsDir = path.join(root, 'commands')
  // A `commands/` folder that the scan cannot read gives fewer entries. That can only hide a
  // duplicate, never add one, so the rule ignores `unreadable` here.
  const commands = (
    setsCommands(root, plugin, bound) ? [] : markdownFiles(commandsDir, bound).files
  ).flatMap((file) => {
    const parts = path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep)
    return refused(parts) ? [] : [{ file, name: parts.join(':') }]
  })
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
    const bound = repositoryRoot(root)
    // A file in `commands/` is not a command when the key replaces the folder.
    if (file.kind === 'command' && setsCommands(root, file.plugin, bound)) {
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
          if (loadedName(fm.data.name) !== null) {
            const field = fm.fields.get('name')
            // A key that is an alias has a value but no field.
            if (field !== undefined) {
              loc = fm.at(field.valueStart, field.valueEnd)
            }
          }
        }
        const own =
          file.kind === 'skill' ? skillName(given, file.names[0] as string) : file.names.join(':')
        // A refused folder or command name has no loaded name to share. A refused `name`
        // field is already replaced by the folder name in `own`.
        if (refused(file.kind === 'skill' ? [own] : file.names)) {
          return
        }
        const others = scopeEntries(root, file.plugin, bound).filter(
          (entry) => entry.file !== self && fold(entry.name) === fold(own),
        )
        if (others.length > 0) {
          context.report({
            loc,
            messageId: 'duplicate',
            data: {
              name: own,
              others: others
                .map((entry) => `\`${shownPath(path.relative(root, entry.file))}\``)
                .join(', '),
            },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
}

export default rule
