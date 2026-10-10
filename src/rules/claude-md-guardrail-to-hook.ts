// Guardrail wording in a CLAUDE.md or a rule file (docs/rules/claude-md-guardrail-to-hook.md).
// The docs say that Claude treats these files as context, not as enforced configuration. A
// PreToolUse hook blocks an action whatever Claude decides, and a hook runs a step at a fixed
// point, such as before every commit. The rule looks for two shapes in the text: a prohibition of
// a verb that a hook can check, and "always" with a fixed point. It reads a paragraph, a heading
// or a table cell of the syntax tree, with each code span and each inline HTML tag hidden. So a
// code span cannot split a sentence, and a code block and an HTML comment are not read. The rule
// is a heuristic, because the docs do not define the wording. Emphasis marks (`*`, and `_` at the
// edge of a word) do not split a match, so `**Never** edit x` is a guardrail.
import type { MarkdownRuleDefinition, MarkdownSourceCode } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'

const name = 'claude-md-guardrail-to-hook' as const

// A prohibition: a negative, then a verb that a hook or a permission rule can check.
const PROHIBITION =
  /\b(?:never|do\s+not|don't|must\s+not|should\s+not|shall\s+not|may\s+not)\s+(?:ever\s+)?(?:edit|modify|overwrite|write to|touch|delete|remove|commit|push|force[- ]push|run|read)\b/

// A step at a fixed point: "always", then "before" a commit or a finish, or "after" an edit.
const FIXED_POINT =
  /\balways\b[^.!?\n]*?\b(?:before\s+(?:you\s+|each\s+|every\s+|a\s+)?(?:commit|push|merge|finish|stop)|after\s+(?:each|every|any)\s+(?:file\s+)?(?:edit|change|write))/

const GUARDRAIL = new RegExp(`${PROHIBITION.source}|${FIXED_POINT.source}`, 'gi')

type Tree = { type: string; children?: Tree[] }
type Node = Parameters<MarkdownSourceCode['getRange']>[0]

/** The ranges of the code spans and of the inline HTML below `node`. */
function hiddenRanges(sourceCode: MarkdownSourceCode, node: Tree, found: [number, number][]) {
  for (const child of node.children ?? []) {
    if (child.type === 'inlineCode' || child.type === 'html') {
      found.push(sourceCode.getRange(child as Node))
    } else {
      hiddenRanges(sourceCode, child, found)
    }
  }
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'guardrail' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a guardrail with a hook or a permission rule, not with CLAUDE.md text',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      guardrail:
        'This wording is a guardrail. Claude treats CLAUDE.md as context, and may not follow it. To block or require an action every time, use a `PreToolUse` hook or a permission rule.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local' && kind !== 'rule') {
      return {}
    }
    const { sourceCode } = context
    return {
      'paragraph, heading, tableCell'(node) {
        const from = sourceCode.getRange(node)[0]
        const hidden: [number, number][] = []
        hiddenRanges(sourceCode, node as Tree, hidden)
        let text = sourceCode.getText(node)
        for (const [start, end] of hidden) {
          text = text.slice(0, start - from) + 'x'.repeat(end - start) + text.slice(end - from)
        }
        // Emphasis marks, a block quote mark and a curly apostrophe must not split a match. Each
        // change keeps the length of the text, so the offsets stay true.
        text = text
          .replaceAll('*', ' ')
          .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, (marks) => ' '.repeat(marks.length))
          .replaceAll('\u2019', "'")
          .replace(/^(?:[ \t]*>)+/gm, (marks) => ' '.repeat(marks.length))
        for (const match of text.matchAll(GUARDRAIL)) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(from + match.index),
              end: sourceCode.getLocFromIndex(from + match.index + match[0].length),
            },
            messageId: 'guardrail',
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/.claude/rules/**/*.md'],
  rule,
}
