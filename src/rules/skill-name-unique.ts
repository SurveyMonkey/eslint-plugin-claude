// In one scope, each skill and command file has its own command name
// (docs/rules/skill-name-unique.md). A scope is a `.claude/` directory or a plugin.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { listedSkills, listingPlugin, readPluginAt } from '../plugin-manifest.ts'
import { classifySkillFile, type SkillFile } from '../skill-files.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'
import { escapeName, firstFault, hyphenate } from '../skill-names.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readManifest,
  realOf,
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

/** `name`, or null when it folds to an empty string. Such a name holds only characters that
 *  `fold` removes, such as soft hyphens. Claude Code 2.1.310 refuses a project skill folder of
 *  soft hyphens only. `skill-name-characters` does not refuse these characters, so the rule
 *  compares no such name. */
function comparable(name: string): string | null {
  return fold(name) === '' ? null : name
}

/** The relative path of a file for a message. This function escapes each part
 *  of the path alone. A space is a fault at the edge of one name. A plugin skill
 *  folder can hold a refused character. No other part of a listed path can. */
function shownPath(relative: string): string {
  return relative.split(path.sep).map(escapeName).join('/')
}

/** True when Claude Code refuses a part of a skill or command name. Claude Code does not
 *  load such a skill or command, and `skill-name-characters` reports it. The rule compares
 *  no such name. The check is for each part alone: a space at the edge of one part is a
 *  fault. A plugin skill folder is the exception. Claude Code loads it with hyphens in place
 *  of the refused characters, and `skill-name-characters` does not report it. When such a
 *  folder has no loaded `name`, `skillName` gives it its name with hyphens. */
function refused(parts: string[]): boolean {
  return parts.some((part) => firstFault(part) !== null)
}

/** The value of the field `name` when it is a string with no refused character, that does not
 *  fold to an empty string, else null. The rule does not check the length. The docs say Claude
 *  Code ignores a refused `name`, and the rule reads that as: the skill goes by its folder name. */
function loadedName(value: unknown): string | null {
  return typeof value === 'string' && firstFault(value) === null ? comparable(value) : null
}

/** The name that Claude Code gives a skill, or null when the rule compares no name for it.
 *  A project skill folder that Claude Code refuses means no load, so the result is null.
 *  Else the name is the field `name` when it is loaded, or the folder name. In a plugin
 *  folder name, each refused character becomes a hyphen. This step comes before `fold`,
 *  because `fold` removes some of these characters. The result holds no refused character.
 *  A folder name that folds to an empty string gives null (see `comparable`). */
function skillName(
  fields: Record<string, unknown> | null,
  folder: string,
  plugin: boolean,
): string | null {
  if (!plugin && refused([folder])) {
    return null
  }
  return loadedName(fields?.name) ?? comparable(hyphenate(folder))
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

/** The skill files of the scope at `root`: each `SKILL.md` in `skills/`, then, in a plugin, each
 *  skill that the paths of the manifest `skills` key give. A file with the real path of a file
 *  before it is left out, as when the key names `skills/`. A manifest that the rule cannot read
 *  gives no paths. */
function skillFilesOf(root: string, plugin: boolean, bound: string): string[] {
  const listing = plugin ? readPluginAt(root) : undefined
  const listed = listing === undefined ? [] : listedSkills(listing).map((skill) => skill.file)
  const seen = new Set<string | null | symbol>()
  return [...skillFiles(path.join(root, 'skills'), bound), ...listed].filter((file) => {
    const real = realOf(file)
    const fresh = !seen.has(real)
    seen.add(real)
    return fresh
  })
}

/** The command name of each skill and command file in the scope at `root`,
 *  read from disk at or below `bound`. The plugin-root `SKILL.md` has no
 *  entry. A project skill or a command with a refused folder or file name has no entry. A
 *  plugin skill with a refused folder name has an entry: its loaded `name`, else its folder
 *  name with hyphens. A name that folds to an empty string has no entry. */
function scopeEntries(root: string, plugin: boolean, bound: string): Entry[] {
  // A skill file that the rule cannot read has no name to compare.
  const skills = skillFilesOf(root, plugin, bound).flatMap((file) => {
    const fields = frontmatterOfFile(file)
    if (fields === UNREADABLE) {
      return []
    }
    const given = skillName(fields, path.basename(path.dirname(file)), plugin)
    return given === null ? [] : [{ file, name: given }]
  })
  const commandsDir = path.join(root, 'commands')
  // A `commands/` folder that the scan cannot read gives fewer entries. That can only hide a
  // duplicate, never add one, so the rule ignores `unreadable` here.
  const commands = (
    setsCommands(root, plugin, bound) ? [] : markdownFiles(commandsDir, bound).files
  ).flatMap((file) => {
    const parts = path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep)
    const given = refused(parts) ? null : comparable(parts.join(':'))
    return given === null ? [] : [{ file, name: given }]
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
    const self = path.resolve(context.filename)
    const classified = classifySkillFile(context.filename)
    // A skill folder that a manifest `skills` path gives is not in `skills/`, so the
    // classification does not know it.
    const listing =
      classified === null && path.basename(self) === 'SKILL.md' ? listingPlugin(self) : undefined
    const file: SkillFile | null =
      listing === undefined
        ? classified
        : { kind: 'skill', plugin: true, names: [listing.skill.folder] }
    // The plugin-root skill has no name from a folder or a path.
    if (file === null || file.names.length === 0) {
      return {}
    }
    const root = listing === undefined ? scopeRoot(self, file) : listing.plugin.root
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
          file.kind === 'skill'
            ? skillName(given, file.names[0] as string, file.plugin)
            : refused(file.names)
              ? null
              : comparable(file.names.join(':'))
        // Claude Code loads no project skill or command with a refused folder or file name. It has
        // no name to share. Nor has a name that folds to an empty string.
        if (own === null) {
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
