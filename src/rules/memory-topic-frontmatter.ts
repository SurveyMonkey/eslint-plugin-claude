// The frontmatter of a memory topic file (docs/rules/memory-topic-frontmatter.md). The docs say
// that auto memory saves four kinds of notes, and that Claude records the kind as a `type` field.
// They say that Claude Code records the write time in a `modified` field as an ISO 8601
// timestamp. The docs state this for the main auto memory, not for the memory of a subagent,
// so the rule is a heuristic. It checks a field only when the file sets it, and it makes no
// report for a file with no frontmatter. The globs name the topic files. The rule leaves the
// `MEMORY.md` index.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'memory-topic-frontmatter' as const

const KINDS = ['user', 'feedback', 'project', 'reference']

// A date, or a date and a time with an optional zone. The groups are the parts that need a range.
const TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/

/** True when `value` is a string in the form of an ISO 8601 date or timestamp, with parts in range. */
function isIsoTimestamp(value: unknown): boolean {
  const match = typeof value === 'string' ? TIMESTAMP.exec(value) : null
  if (match === null) {
    return false
  }
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => Number(part ?? 0)) as [number, number, number, number, number, number]
  // Day 0 of the next month is the last day of this month.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= last &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  )
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'badType' | 'badModified' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give a memory topic file a valid type and an ISO 8601 modified time',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      badType:
        '`type` is {{value}}. Claude records one of `user`, `feedback`, `project` or `reference`.',
      badModified:
        '`modified` is {{value}}. Claude Code writes an ISO 8601 timestamp, such as 2026-10-14T09:30:00Z.',
    },
  },
  create(context) {
    if (path.basename(context.filename) === 'MEMORY.md') {
      return {}
    }
    const { sourceCode } = context
    return {
      yaml(node) {
        const fm = readFrontmatter(sourceCode, node)
        if (fm === null) {
          return
        }
        for (const [key, messageId, valid] of [
          ['type', 'badType', (value: unknown) => KINDS.includes(value as string)],
          ['modified', 'badModified', isIsoTimestamp],
        ] as const) {
          const field = fm.fields.get(key)
          if (field !== undefined && !valid(fm.data[key])) {
            // A key with no value has an empty range, so the report goes on the key.
            const empty = field.valueStart === field.valueEnd
            context.report({
              loc: empty
                ? fm.at(field.keyStart, field.keyEnd)
                : fm.at(field.valueStart, field.valueEnd),
              messageId,
              data: { value: JSON.stringify(fm.data[key]) },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/agent-memory/*/*.md'],
  rule,
}
