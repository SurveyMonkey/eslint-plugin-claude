// The skills of one source register at most 1,024 frontmatter hooks. The matchers of those hooks
// total at most 16,384 characters (docs/rules/hooks-skill-source-limit.md). A source is one
// `.claude/` directory or one plugin. The rule reads no file out of the repository. The docs
// show no setting that moves the two limits. So the schema sets each one as the maximum of its
// option.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { fromData, handlersOf } from '../hooks-config.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  realOf,
  repositoryRoot,
  scopeRoot,
  skillFiles,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'hooks-skill-source-limit' as const

// The limits in the docs, and the defaults of `maxHooks` and `maxMatcherChars`.
const MAX_HOOKS = 1024
const MAX_MATCHER_CHARS = 16384

type Options = [{ maxHooks: number; maxMatcherChars: number }]

interface Count {
  hooks: number
  chars: number
}

// The count of each set of fields. `frontmatterOfFile` gives the same object while a file stays
// the same. So the rule finds the count of a file once, and uses it again for each skill that it
// lints.
const counts = new WeakMap<object, Count>()

/** The hooks of the frontmatter fields `fields`, and the characters of their matchers. A
 *  matcher counts once for each hook under it. A group with no string matcher adds no
 *  characters. Fields that are null add nothing. Claude Code skips an event name that it does
 *  not know, so the hooks under that name add nothing. */
function countOf(fields: Record<string, unknown> | null): Count {
  if (fields === null) {
    return { hooks: 0, chars: 0 }
  }
  const known = counts.get(fields)
  if (known !== undefined) {
    return known
  }
  const handlers = handlersOf({
    kind: 'skill',
    hooks: fromData(fields.hooks),
    file: undefined,
  }).filter(({ event }) => HOOK_EVENTS.includes(event))
  const count = {
    hooks: handlers.length,
    chars: handlers.reduce((sum, { matcher }) => sum + (matcher?.length ?? 0), 0),
  }
  counts.set(fields, count)
  return count
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'hooks' | 'matchers' | 'hooksOverConfiguredLimit' | 'matchersOverConfiguredLimit'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the skill hooks of one source within the limits of Claude Code',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxHooks: {
            description: 'The most frontmatter hooks in the skills of one source.',
            type: 'integer',
            minimum: 1,
            maximum: MAX_HOOKS,
          },
          maxMatcherChars: {
            description: 'The most matcher characters in the skill hooks of one source.',
            type: 'integer',
            minimum: 1,
            maximum: MAX_MATCHER_CHARS,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxHooks: MAX_HOOKS, maxMatcherChars: MAX_MATCHER_CHARS }],
    messages: {
      hooks:
        'The skills of this source declare {{total}} hooks, {{own}} of them in this skill. A source can register at most {{max}} hooks. A skill past the limit registers none of its hooks.',
      matchers:
        'The matchers of the skill hooks of this source total {{total}} characters, {{own}} of them in this skill. The matchers of a source can total at most {{max}} characters. A skill past the limit registers none of its hooks.',
      hooksOverConfiguredLimit:
        'The skills of this source declare {{total}} hooks, {{own}} of them in this skill. The configured limit is {{max}} hooks.',
      matchersOverConfiguredLimit:
        'The matchers of the skill hooks of this source total {{total}} characters, {{own}} of them in this skill. The configured limit is {{max}} characters.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    // The rule does not count a plugin-root skill. See the rule doc.
    if (file?.kind !== 'skill' || file.names.length === 0) {
      return {}
    }
    const [{ maxHooks, maxMatcherChars }] = context.options
    const self = path.resolve(context.filename)
    // Claude Code loads a skill once, when several folder links point at it. For a plugin skill,
    // a probe of Claude Code 2.1.310 shows this. See the rule doc.
    const selfReal = realOf(self)
    // The rule cannot tell a link to this file from a second skill, so it makes no report.
    if (selfReal === UNREADABLE) {
      return {}
    }
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
        // The real paths of the skills that the sum holds. A null `selfReal` is a file that is
        // not on disk.
        const seen = new Set<string>(selfReal === null ? [] : [selfReal])
        // This file is in `seen`, so the loop skips it and each link to it.
        for (const other of skillFiles(path.join(root, 'skills'), bound)) {
          // `skillFiles` gives only the files whose real path it can read.
          const real = realOf(other) as string
          if (seen.has(real)) {
            continue
          }
          seen.add(real)
          const fields = frontmatterOfFile(other)
          // The rule adds no hooks for a file that it cannot read. That file can only make the
          // sum larger, so no report rests on it.
          const count = countOf(typeof fields === 'object' ? fields : null)
          total.hooks += count.hooks
          total.chars += count.chars
        }
        const field = fm.fields.get('hooks')
        // A key that is an alias has a value but no field.
        const loc =
          field === undefined ? sourceCode.getLoc(first) : fm.at(field.keyStart, field.keyEnd)
        if (total.hooks > maxHooks) {
          context.report({
            loc,
            // At another value, the message names the configured limit and claims no docs limit.
            messageId: maxHooks === MAX_HOOKS ? 'hooks' : 'hooksOverConfiguredLimit',
            data: { total: String(total.hooks), own: String(own.hooks), max: String(maxHooks) },
          })
        }
        // A skill that adds no matcher characters cannot take the sum past the limit.
        if (own.chars > 0 && total.chars > maxMatcherChars) {
          context.report({
            loc,
            messageId:
              maxMatcherChars === MAX_MATCHER_CHARS ? 'matchers' : 'matchersOverConfiguredLimit',
            data: {
              total: String(total.chars),
              own: String(own.chars),
              max: String(maxMatcherChars),
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
  files: ['**/SKILL.md'],
}

export default rule
