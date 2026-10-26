// The skills of one source register at most 1,024 frontmatter hooks, and the matchers of those
// hooks total at most 16,384 characters (docs/rules/hooks-skill-source-limit.md). A source is
// one `.claude/` directory or one plugin. The rule reads no file out of the repository.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { fromData, handlersOf } from '../hooks-config.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { frontmatterOfFile, repositoryRoot, scopeRoot, skillFiles } from '../skill-tree.ts'

const name = 'hooks-skill-source-limit' as const

/** The most hooks that the skills of one source can register. */
const MAX_HOOKS = 1024

/** The most matcher characters that the hooks of one source can total. */
const MAX_MATCHER_CHARS = 16384

interface Count {
  hooks: number
  chars: number
}

// The count of each set of fields. `frontmatterOfFile` gives the same object while a file stays
// the same, so the rule counts each file of a source once.
const counts = new WeakMap<object, Count>()

/** The hooks of the frontmatter fields `fields`, and the characters of their matchers. A
 *  matcher counts once for each hook under it. A group with no string matcher adds no
 *  characters. Fields that are null add nothing. */
function countOf(fields: Record<string, unknown> | null): Count {
  if (fields === null) {
    return { hooks: 0, chars: 0 }
  }
  const known = counts.get(fields)
  if (known !== undefined) {
    return known
  }
  const handlers = handlersOf({ kind: 'skill', hooks: fromData(fields.hooks), file: undefined })
  const count = {
    hooks: handlers.length,
    chars: handlers.reduce((sum, { matcher }) => sum + (matcher?.length ?? 0), 0),
  }
  counts.set(fields, count)
  return count
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'hooks' | 'matchers' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the skill hooks of one source within the limits of Claude Code',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      hooks:
        'The skills of this source declare {{total}} hooks, and this skill declares {{own}}. A source can register at most 1,024. A skill past the limit registers none of its hooks, and Claude Code shows no error.',
      matchers:
        'The matchers of the skill hooks of this source total {{total}} characters, and this skill adds {{own}}. A source can register at most 16,384. A skill past the limit registers none of its hooks, and Claude Code shows no error.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // The plugin-root skill loads only when the plugin has no `skills/` directory.
    if (file?.kind !== 'skill' || file.names.length === 0) {
      return {}
    }
    const self = path.resolve(context.filename)
    const root = scopeRoot(self, file)
    const bound = repositoryRoot(root)
    const { sourceCode } = context
    return {
      root(node) {
        const first = node.children[0]
        if (first?.type !== 'yaml') {
          return
        }
        // The text of this file is the text in the editor, not the text on disk. Frontmatter that
        // does not parse gives a skill with no hooks.
        const fm = readFrontmatter(sourceCode, first)
        if (fm === null) {
          return
        }
        const own = countOf(fm.data)
        if (own.hooks === 0) {
          return
        }
        const total = { ...own }
        for (const other of skillFiles(path.join(root, 'skills'), bound)) {
          if (other === self) {
            continue
          }
          const fields = frontmatterOfFile(other)
          // A file that the rule cannot read adds no hooks to the sum. It can only add to it.
          const count = countOf(typeof fields === 'object' ? fields : null)
          total.hooks += count.hooks
          total.chars += count.chars
        }
        const field = fm.fields.get('hooks')
        // A key that is an alias has a value but no field.
        const loc =
          field === undefined ? sourceCode.getLoc(first) : fm.at(field.keyStart, field.keyEnd)
        if (total.hooks > MAX_HOOKS) {
          context.report({
            loc,
            messageId: 'hooks',
            data: { total: String(total.hooks), own: String(own.hooks) },
          })
        }
        if (total.chars > MAX_MATCHER_CHARS) {
          context.report({
            loc,
            messageId: 'matchers',
            data: { total: String(total.chars), own: String(own.chars) },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md'],
}

export default rule
