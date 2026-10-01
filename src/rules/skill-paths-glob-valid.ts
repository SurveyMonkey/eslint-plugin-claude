// A `paths` glob of a skill must be one that Claude Code can use
// (docs/rules/skill-paths-glob-valid.md). The rule checks the two faults that
// the docs name: a `[` with no bracket expression, and brace groups that
// expand past the budget.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-paths-glob-valid' as const

const MAX_PATTERNS = 1000
const MAX_BYTES = 4 * 1024 * 1024
// A cap that keeps the products finite for a pattern with many groups.
const CAP = 1e12

/** The index of the `}` that closes each `{` of `text`, by the index of the
 *  `{`. A `{` with no `}` has no entry. A backslash escapes the next character. */
function braceMatches(text: string): Map<number, number> {
  const matches = new Map<number, number>()
  const open: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') {
      i++
    } else if (ch === '{') {
      open.push(i)
    } else if (ch === '}' && open.length > 0) {
      matches.set(open.pop() as number, i)
    }
  }
  return matches
}

/** The indexes of the commas of `text` between `from` and `to` that are not
 *  inside a brace group. */
function topCommas(text: string, matches: Map<number, number>, from: number, to: number): number[] {
  const commas: number[] = []
  for (let i = from; i < to; i++) {
    const close = matches.get(i)
    if (text[i] === '\\') {
      i++
    } else if (close !== undefined) {
      i = close
    } else if (text[i] === ',') {
      commas.push(i)
    }
  }
  return commas
}

interface Size {
  /** The number of patterns after expansion. */
  count: number
  /** The bytes of all patterns after expansion. */
  bytes: number
  /** True when the text has a brace group with a comma. */
  braced: boolean
}

const cap = (n: number) => Math.min(n, CAP)

/** The size of the expansion of `text` between `from` and `to`. */
function measure(text: string, matches: Map<number, number>, from: number, to: number): Size {
  let size: Size = { count: 1, bytes: 0, braced: false }
  /** Append the parts `parts`, each one a choice, to the text so far. */
  const append = (parts: Size[]) => {
    const count = parts.reduce((sum, part) => sum + part.count, 0)
    const bytes = parts.reduce((sum, part) => sum + part.bytes, 0)
    size = {
      count: cap(size.count * count),
      bytes: cap(size.bytes * count + bytes * size.count),
      braced: size.braced || parts.some((part) => part.braced) || parts.length > 1,
    }
  }
  const literal = (chars: string) =>
    append([{ count: 1, bytes: Buffer.byteLength(chars), braced: false }])
  // The text from `run` to the next group is one literal.
  let run = from
  for (let i = from; i < to; i++) {
    const close = matches.get(i)
    // An escaped brace has no entry in `matches`.
    if (close !== undefined) {
      literal(text.slice(run, i))
      const commas = topCommas(text, matches, i + 1, close)
      const cuts = [i, ...commas, close]
      const parts = cuts
        .slice(0, -1)
        .map((start, n) => measure(text, matches, start + 1, cuts[n + 1] as number))
      if (commas.length === 0) {
        // Without a comma, the braces stay as text and the inside may expand.
        literal('{')
        append(parts)
        literal('}')
      } else {
        append(parts)
      }
      i = close
      run = close + 1
    }
  }
  literal(text.slice(run, to))
  return size
}

/** True when `pattern` has a `[` that starts no bracket expression. */
function hasBrokenBracket(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      i++
    } else if (pattern[i] === '[') {
      let j = i + 1
      if (pattern[j] === '!' || pattern[j] === '^') {
        j++
      }
      // A `]` right after the opening is a member, not the end.
      if (pattern[j] === ']') {
        j++
      }
      while (j < pattern.length && pattern[j] !== ']') {
        j += pattern[j] === '\\' ? 2 : 1
      }
      if (j >= pattern.length) {
        return true
      }
      i = j
    }
  }
  return false
}

/** The patterns of a `paths` value: each item of a list, or each part of a
 *  comma-separated string. */
function patternsOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value !== 'string') {
    return []
  }
  const matches = braceMatches(value)
  const cuts = [-1, ...topCommas(value, matches, 0, value.length), value.length]
  return cuts.slice(0, -1).map((start, n) => value.slice(start + 1, cuts[n + 1]).trim())
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'bracket' | 'budget' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use valid globs in the `paths` field of a skill',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bracket:
        '`{{pattern}}` has a `[` that starts no bracket expression. Claude Code matches no file with it. Escape the `[` as `\\[`.',
      budget:
        'The brace groups in `paths` expand to {{count}} patterns and {{bytes}} bytes. The limit is 1,000 patterns and 4 MiB. Claude Code then keeps the patterns as they are, and their braces match no file.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const field = fm.fields.get('paths')
        if (field === undefined) {
          return
        }
        const loc = fm.at(field.valueStart, field.valueEnd)
        let count = 0
        let bytes = 0
        for (const pattern of patternsOf(fm.data.paths)) {
          if (hasBrokenBracket(pattern)) {
            context.report({ loc, messageId: 'bracket', data: { pattern } })
          }
          const size = measure(pattern, braceMatches(pattern), 0, pattern.length)
          if (size.braced) {
            count += size.count
            bytes += size.bytes
          }
        }
        if (count > MAX_PATTERNS || bytes > MAX_BYTES) {
          context.report({
            loc,
            messageId: 'budget',
            data: { count: String(count), bytes: String(bytes) },
          })
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
