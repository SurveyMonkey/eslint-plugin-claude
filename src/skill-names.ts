// This module holds the name checks of the skill rules. It also holds the text that
// shows a name in a message. Each skill rule that prints a name uses `escapeName`.

/** Each class of characters in the docs, with the text of the message.
 *  U+FEFF has the Unicode name ZERO WIDTH NO-BREAK SPACE, so this module counts it
 *  as a zero-width space. `kindAt` checks a plain space before it reads the classes. */
const CLASSES: [RegExp, string][] = [
  [/[\u{200B}\u{FEFF}]/u, 'a zero-width space'],
  [/\p{Cc}/u, 'a control character'],
  [/\p{Co}/u, 'a private-use character'],
  [/\p{Cn}/u, 'an unassigned character'],
  [/\p{Bidi_Control}/u, 'a character that changes the text direction'],
  [/\p{Z}/u, 'a blank that is not a plain space'],
  [/[<>]/u, 'an angle bracket'],
]

/** The text of the class of the character at `index` of `chars`, or
 *  undefined when Claude Code takes the character. A plain space is a fault
 *  at the start or the end, or before another space. */
function kindAt(chars: string[], index: number): string | undefined {
  const char = chars[index] as string
  if (char !== ' ') {
    return CLASSES.find(([pattern]) => pattern.test(char))?.[1]
  }
  return index === 0 || index === chars.length - 1 || chars[index + 1] === ' '
    ? 'a space at the start or end, or next to another space'
    : undefined
}

/** The code point of `char` as `U+XXXX`, with at least four upper-case hex digits. */
function codeOf(char: string): string {
  const point = (char.codePointAt(0) as number).toString(16).toUpperCase()
  return `U+${point.padStart(4, '0')}`
}

/** The first character of `text` that Claude Code refuses, as its code point
 *  and the text of its class, or null. */
export function firstFault(text: string): { code: string; kind: string } | null {
  const chars = [...text]
  for (const [index, char] of chars.entries()) {
    const kind = kindAt(chars, index)
    if (kind !== undefined) {
      return { code: codeOf(char), kind }
    }
  }
  return null
}

/** `text` for a message. Each character that `CLASSES` and `kindAt` refuse
 *  prints as `<U+XXXX>`. So a direction control or a zero-width space cannot hide
 *  in the message. */
export function escapeName(text: string): string {
  const chars = [...text]
  return chars
    .map((char, index) => (kindAt(chars, index) === undefined ? char : `<${codeOf(char)}>`))
    .join('')
}

/** True when the character at `index` of `chars` is a plain space next to a blank. A blank is a
 *  plain space or another `\p{Z}` character. `hyphenate` asks only about a space that `kindAt`
 *  takes, and such a space is not at the start or the end. */
function besideBlank(chars: string[], index: number): boolean {
  const blank = /\p{Z}/u
  return (
    chars[index] === ' ' &&
    (blank.test(chars[index - 1] as string) || blank.test(chars[index + 1] as string))
  )
}

/** `text` with each character that `CLASSES` and `kindAt` refuse as one `-`. The docs say that
 *  these characters become hyphens in the command name of a plugin skill folder. The docs refuse
 *  a blank other than one plain space between words. The rule reads this as: a plain space next
 *  to another blank becomes a hyphen too. `kindAt` takes such a space in two cases. The blank is
 *  before it, or the blank after it is not a plain space. The function does not join a run of
 *  hyphens. Each other character that `kindAt` takes stays. */
export function hyphenate(text: string): string {
  const chars = [...text]
  return chars
    .map((char, index) =>
      kindAt(chars, index) === undefined && !besideBlank(chars, index) ? char : '-',
    )
    .join('')
}
