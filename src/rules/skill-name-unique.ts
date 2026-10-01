// In one scope, each skill and command file has its own command name
// (docs/rules/skill-name-unique.md). A scope is a `.claude/` directory or a plugin.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'
import { frontmatterOfFile, markdownFiles, scopeRoot } from '../skill-tree.ts'

const name = 'skill-name-unique' as const

/** The name without the differences that Claude Code ignores when it compares
 *  names: case, spacing, invisible characters, compatibility forms such as
 *  fullwidth letters, and dash variants. */
function fold(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
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

/** The command name of each skill and command file in the scope at `root`,
 *  read from disk. The plugin-root `SKILL.md` has no entry. */
function scopeEntries(root: string): Entry[] {
  const skillsDir = path.join(root, 'skills')
  const skills = markdownFiles(skillsDir)
    .filter(
      (file) =>
        path.basename(file) === 'SKILL.md' && path.dirname(path.dirname(file)) === skillsDir,
    )
    .map((file) => ({
      file,
      name: skillName(frontmatterOfFile(file), path.basename(path.dirname(file))),
    }))
  const commandsDir = path.join(root, 'commands')
  const commands = markdownFiles(commandsDir).map((file) => ({
    file,
    name: path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep).join(':'),
  }))
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
        '`{{name}}` is also the command name of {{others}}. One of them does not run. Rename one.',
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
          const field = fm.fields.get('name')
          if (field !== undefined && typeof fm.data.name === 'string' && fm.data.name !== '') {
            loc = fm.at(field.valueStart, field.valueEnd)
          }
        }
        const own =
          file.kind === 'skill' ? skillName(given, file.names[0] as string) : file.names.join(':')
        const others = scopeEntries(root).filter(
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
