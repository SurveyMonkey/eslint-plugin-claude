// The split of a shell command into subcommands, for a rule that reads an injected command or a
// Bash rule as text. The split follows the compound commands of the permissions page.
// It is a heuristic, not a shell parser.

/** Commands that run without a permission prompt, from the permissions page: "The set includes".
 *  The docs do not list the rest of the set. The rule treats each name as read-only with any
 *  flags. `git` is here whole, because the docs name only "read-only forms of `git`". */
export const READ_ONLY = new Set([
  'ls',
  'cat',
  'echo',
  'pwd',
  'head',
  'tail',
  'grep',
  'find',
  'wc',
  'which',
  'diff',
  'stat',
  'du',
  'cd',
  'git',
])

/** The words that start a shell block, and the head of a `case`. They are not commands. The rule
 *  drops them from the start of a subcommand and judges the rest. A word alone on its line leaves
 *  nothing. `(` and `{` need no space after them. */
const OPENING =
  /^(?:(?:if|then|else|elif|do|while|until|!)(?![\w-])|[({]|case\s.*?\sin(?![\w-]))\s*/
/** The pattern of a `case` arm, such as `a)` or `*)`. The rule drops it only in a text with `case`. */
const ARM = /^[\w*.\-"']+\)\s*/
// The parts of a command that hide a separator: a quoted string, and a redirection such as
// `2>&1` or `&>`.
const HIDDEN = /"(?:[^"\\]|\\.)*"|'[^']*'|\d*[<>]&\d*-?|&>>?/gs

// The separators of the permissions page: `&&`, `||`, `;`, `|`, `|&`, `&` and a line break.
const SEPARATOR = /&&|\|\||\|&|[;|&\n]/g

// The patterns of a `case` arm that has a `|`, at the start of a line.
const ARM_ALTERNATION = /^([ \t]*)[\w*."'-]+(?:\|[\w*."'-]+)+\)/gm

// A comment line. The rule drops it first, because its text can hold a quote or a separator.
const COMMENT_LINE = /^[ \t]*#.*$/gm

/** The subcommands of `text`. A line break after a backslash does not split. */
export function subcommands(text: string): string[] {
  const lines = text.replace(COMMENT_LINE, '').replaceAll('\\\n', ' ')
  const hasCase = /(?:^|\s)case\s/.test(lines)
  // The `|` between the patterns of a `case` arm is not a pipe.
  const joined = hasCase ? lines.replace(ARM_ALTERNATION, '$1x)') : lines
  const masked = joined.replace(HIDDEN, (part) => 'x'.repeat(part.length))
  const parts: string[] = []
  let from = 0
  for (const match of masked.matchAll(SEPARATOR)) {
    parts.push(joined.slice(from, match.index))
    from = match.index + match[0].length
  }
  parts.push(joined.slice(from))
  const heads = hasCase ? [OPENING, ARM] : [OPENING]
  return parts
    .map((part) => {
      let rest = part.trim()
      for (let head = heads.find((h) => h.test(rest)); head !== undefined; ) {
        rest = rest.replace(head, '')
        head = heads.find((h) => h.test(rest))
      }
      return closeless(rest)
    })
    .filter((part) => part !== '')
}

/** `part` without the `)` at its end that closes a group the part did not open. */
function closeless(part: string): string {
  const opens = part.split('(').length - 1
  const closes = part.split(')').length - 1
  return closes > opens ? part.replace(/\s*\)+$/, '') : part
}

/** The words of a subcommand, each with no quote around it. */
export function wordsOf(subcommand: string): string[] {
  return subcommand.split(/\s+/).map((word) => word.replaceAll(/^["']|["']$/g, ''))
}
