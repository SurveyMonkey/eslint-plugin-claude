// The grammar of one permission rule: `Tool` or `Tool(specifier)`
// (https://code.claude.com/docs/en/permissions#permission-rule-syntax).
// The parser takes a string and knows nothing of JSON or of a file format.
// Each place that holds a permission rule uses it.

/** Why a string is not a rule. */
type ParseFailureReason = 'emptyTool' | 'unbalanced' | 'trailingText' | 'nulByte'

/** A rule that parsed. `specifier` is null for the bare form, and a string for
 *  the form with parentheses. The string is empty for `Tool()`. */
export interface ParsedRule {
  readonly ok: true
  readonly tool: string
  readonly specifier: string | null
}

/** A string that is not a rule, and the reason. */
interface ParseFailure {
  readonly ok: false
  readonly reason: ParseFailureReason
}

export type ParseResult = ParsedRule | ParseFailure

function fail(reason: ParseFailureReason): ParseFailure {
  return { ok: false, reason }
}

/** Parse `text` as one permission rule. The tool name ends at the first `(`.
 *  The specifier ends at the last `)`, because the docs make parentheses
 *  inside a specifier literal. The parser does not trim, and it does not
 *  check that the tool name is a known tool. */
export function parsePermissionRule(text: string): ParseResult {
  if (text.includes('\0')) {
    return fail('nulByte')
  }
  const open = text.indexOf('(')
  const tool = open === -1 ? text : text.slice(0, open)
  if (tool === '') {
    return fail('emptyTool')
  }
  if (tool.includes(')')) {
    return fail('unbalanced')
  }
  if (open === -1) {
    return { ok: true, tool, specifier: null }
  }
  const close = text.lastIndexOf(')')
  if (close < open) {
    return fail('unbalanced')
  }
  if (close !== text.length - 1) {
    return fail('trailingText')
  }
  return { ok: true, tool, specifier: text.slice(open + 1, close) }
}

/** The parameter name of a `param:value` specifier, or null. Deny and ask
 *  rules use this form to match a top-level input parameter. Space around the
 *  colon does not matter. The name is a plain identifier, so a command
 *  pattern such as `git:*` is also read as a parameter name. A caller must
 *  act only on a name that it knows. */
export function paramName(specifier: string): string | null {
  return /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(specifier)?.[1] ?? null
}
