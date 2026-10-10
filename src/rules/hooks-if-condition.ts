// The `if` field of a hook handler holds one permission rule, and Claude Code evaluates it on tool
// events only (docs/rules/hooks-if-condition.md). The rule uses the parser of `src/permission-rule.ts`,
// the one parser of the permission rule grammar. The tool of the rule must be one that the matcher of
// the group selects. `hooks-config-schema` reports an `if` that is not a string.
import type { Rule } from 'eslint'
import { HOOK_EVENTS, TOOL_EVENTS } from '../data/hook-events.ts'
import { MCP_PREFIX, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, HOOKS_TARGET, handlersOf, hooksListener, memberOf } from '../hooks-config.ts'
import { type ParseFailureReason, parsePermissionRule } from '../permission-rule.ts'

const name = 'hooks-if-condition' as const

/** The tools that one rule format covers, from the "Applies to" column of the rule format table in the
 *  tools reference. A tool that is in no family stands alone. */
const FAMILIES: readonly (readonly string[])[] = [
  ['Bash', 'Monitor'],
  ['Read', 'Grep', 'Glob', 'LSP'],
  ['Edit', 'Write', 'NotebookEdit'],
]

/** A `)`, then `&&`, `||` or a comma, then what looks like another rule: a name, then
 *  a parenthesis, the end of the text or another operator. A literal parenthesis inside a specifier
 *  is not followed by a name in this way. */
const SECOND_RULE = /\)\s*(&&|\|\||,)\s*[A-Za-z_][\w-]*\s*(?:\(|$|&&|\|\||,)/
/** An operator in the tool part, such as `Bash && Edit`. */
const OPERATOR_IN_TOOL = /&&|\|\||,/

const parseMessages: Record<ParseFailureReason, string> = {
  emptyTool: 'The "if" field is not a permission rule: it has no tool name.',
  unbalanced: 'The "if" field is not a permission rule: it has unbalanced parentheses.',
  trailingText: 'The "if" field is not a permission rule: it has text after the final parenthesis.',
  nulByte: 'The "if" field is not a permission rule: it holds a NUL byte.',
}

/** The operator that joins two rules in `text`, or undefined. The check reads the raw text, because
 *  the parser reads `Bash(a) && Edit(b)` as one rule for `Bash`. */
function operatorOf(text: string): string | undefined {
  const tool = text.slice(0, text.includes('(') ? text.indexOf('(') : text.length)
  return OPERATOR_IN_TOOL.exec(tool)?.[0] ?? SECOND_RULE.exec(text)?.[1]
}

/** True when the matcher selects one of `tools`, or when the rule cannot tell. A case variant
 *  counts as a selection, because `hooks-matcher-never-matches` reports it. */
function selects(matcher: string, tools: readonly string[]): boolean {
  if (matcher === '' || matcher === '*') {
    return true
  }
  const values = exactValues(matcher, false)
  if (values !== null) {
    const folded = tools.map((tool) => tool.toLowerCase())
    return values.some((value) => folded.includes(value.toLowerCase()))
  }
  try {
    const pattern = new RegExp(matcher)
    return tools.some((tool) => pattern.test(tool))
  } catch {
    // `hooks-matcher-syntax` reports a pattern that does not compile.
    return true
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the if field of a hook as one permission rule on a tool event',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      event: 'The "if" field works on tool events only. On {{event}} the hook never runs.',
      multiple:
        'The "if" field holds one permission rule. Use one handler for each rule, not "{{operator}}".',
      toolNotMatched:
        'The matcher "{{matcher}}" never selects the tool "{{tool}}" of this "if" rule, so the hook never runs.',
      ...parseMessages,
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher, handler } of handlersOf(source)) {
        const node = memberOf(handler, 'if')?.value
        // `hooks-config-schema` reports an `if` that is not a string.
        if (node?.kind !== 'string' || !HOOK_EVENTS.includes(event)) {
          continue
        }
        const { loc, value } = node
        if (!TOOL_EVENTS.includes(event)) {
          context.report({ loc, messageId: 'event', data: { event } })
          continue
        }
        if (value === '') {
          continue
        }
        const operator = operatorOf(value)
        if (operator !== undefined) {
          context.report({ loc, messageId: 'multiple', data: { operator } })
          continue
        }
        const parsed = parsePermissionRule(value)
        if (!parsed.ok) {
          context.report({ loc, messageId: parsed.reason })
          continue
        }
        const { tool } = parsed
        const known =
          TOOL_NAMES.includes(tool) || (tool.startsWith(MCP_PREFIX) && !tool.includes('*'))
        if (matcher !== undefined && known) {
          const family = FAMILIES.find((tools) => tools.includes(tool)) ?? [tool]
          if (!selects(matcher, family)) {
            context.report({ loc, messageId: 'toolNotMatched', data: { matcher, tool } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
