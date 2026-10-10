// Claude Code puts the name and description of each skill in a listing with a character budget
// (docs/rules/skill-listing-budget.md). The documented fallback is 8,000 characters. The rule is
// a heuristic: the live budget is 1% of the context window, and two settings move it. It sums
// the entries of one scope, a `.claude/` directory or a plugin root, and reads no file out of
// the repository.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { stringField } from '../frontmatter.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readManifest,
  repositoryRoot,
  scopeRoot,
  skillFiles,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'skill-listing-budget' as const

// The documented fallback budget, and the default of `max`.
const LISTING_BUDGET = 8000

// The documented cut for the text of one entry, and the default of `listingMax`.
const ENTRY_CUT = 1536

type Options = [{ max: number; listingMax: number }]

/** The characters that one file adds to the listing. A skill with `disable-model-invocation: true`
 *  is not in the listing, so it adds none. The name is the `name` field of a skill, or the
 *  fallback. Claude Code cuts the text of `description` and `when_to_use` at `cut`. */
function listedChars(
  fields: Record<string, unknown> | null,
  fallback: string,
  cut: number,
  named: boolean,
): number {
  if (fields?.['disable-model-invocation'] === true) {
    return 0
  }
  const given = fields === null ? '' : stringField(fields, 'name')
  const label = named && given !== '' ? given : fallback
  const text =
    fields === null
      ? 0
      : stringField(fields, 'description').length + stringField(fields, 'when_to_use').length
  return label.length + Math.min(text, cut)
}

/** The skill and command files of the scope at `root`, as paths with a fallback name. Returns
 *  null when the scope has a part that the rule cannot see: a manifest that it cannot read, a
 *  `skills` key that moves the folder, or a directory that it cannot read in full. */
function scopeFiles(
  root: string,
  plugin: boolean,
  bound: string,
): { file: string; fallback: string; named: boolean }[] | null {
  const manifest = plugin ? readManifest(root, bound) : null
  if (manifest === UNREADABLE || (manifest !== null && 'skills' in manifest)) {
    return null
  }
  const commandsDir = path.join(root, 'commands')
  const scan = markdownFiles(commandsDir, bound)
  if (scan.unreadable || scan.outside) {
    return null
  }
  const skills = skillFiles(path.join(root, 'skills'), bound).map((file) => ({
    file,
    fallback: path.basename(path.dirname(file)),
    named: true,
  }))
  // A plugin that sets `commands` does not load the `commands/` folder.
  const commands = (manifest !== null && 'commands' in manifest ? [] : scan.files).map((file) => ({
    file,
    fallback: path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep).join(':'),
    named: false,
  }))
  return [...skills, ...commands]
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'overFallbackBudget' | 'overConfiguredLimit'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep the skill and command descriptions of one scope within the listing budget',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          max: { type: 'integer', minimum: 1 },
          listingMax: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: LISTING_BUDGET, listingMax: ENTRY_CUT }],
    messages: {
      overFallbackBudget:
        'The skills and commands of this scope list {{total}} characters of names and descriptions, and this file adds {{own}}. The documented fallback budget is {{max}} characters. Claude Code drops descriptions past the budget. The skills that you invoke least lose theirs first.',
      overConfiguredLimit:
        'The skills and commands of this scope list {{total}} characters of names and descriptions, and this file adds {{own}}. The configured limit is {{max}} characters.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // The plugin-root skill has no folder. Its plugin may not load `skills/` at all.
    if (file === null || file.names.length === 0) {
      return {}
    }
    const [{ max, listingMax }] = context.options
    const self = path.resolve(context.filename)
    const root = scopeRoot(self, file)
    const bound = repositoryRoot(root)
    const { sourceCode } = context
    return {
      root(node) {
        const files = scopeFiles(root, file.plugin, bound)
        if (files === null) {
          return
        }
        const first = node.children[0]
        // The text of this file is the text in the editor, not the text on disk.
        const memory =
          first?.type === 'yaml' ? (readFrontmatter(sourceCode, first)?.data ?? null) : null
        const own = listedChars(
          memory,
          file.kind === 'skill' ? (file.names[0] as string) : file.names.join(':'),
          listingMax,
          file.kind === 'skill',
        )
        let total = own
        for (const entry of files) {
          if (entry.file === self) {
            continue
          }
          const fields = frontmatterOfFile(entry.file)
          // A file that the rule cannot read gives no sum to report.
          if (fields === UNREADABLE) {
            return
          }
          total += listedChars(fields, entry.fallback, listingMax, entry.named)
        }
        if (total > max) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: max === LISTING_BUDGET ? 'overFallbackBudget' : 'overConfiguredLimit',
            data: { total: String(total), own: String(own), max: String(max) },
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
