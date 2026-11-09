// This module holds the name checks of the skill rules. It also holds the text that
// shows a name in a message. Each skill rule that prints a name uses `escapeName`.

/** Each class of characters that Claude Code refuses, with the text of the message.
 *  The docs name the first seven classes (skills, "Characters a skill name can't hold").
 *  U+FEFF has the Unicode name ZERO WIDTH NO-BREAK SPACE, so this module counts it
 *  as a zero-width space. `kindAt` checks a plain space before it reads the classes.
 *
 *  The last two classes come from a probe of Claude Code 2.1.319. The docs give no list for
 *  them. The debug log of the probe says that a name may not hold "hidden, direction-changing
 *  or blank-like characters". Claude Code refused each of these in a project skill folder:
 *  - Each probed `Cf` character: U+00AD, U+200C, U+200D, U+2060, U+2061, U+2062, U+180E,
 *    U+FFF9, U+FFFB, U+E0001, U+E0020, U+0600, U+070F, U+08E2, U+110BD, U+1BCA0, U+1BCA3,
 *    U+13430, U+1D173 and U+1D17A.
 *  - Each probed `Default_Ignorable_Code_Point` character that is not `Cf`: U+034F, U+115F,
 *    U+1160, U+17B4, U+17B5, U+180B, U+180F, U+3164, U+FFA0, U+FE00, U+FE0E, U+FE0F, U+E0100
 *    and U+E01EF.
 *  - Three blank-like characters that are in neither class: U+2800, U+FFFC and U+1D159.
 *  Claude Code took these neighbours: U+2801, U+FFFD, U+2423, U+2588, U+1D158, U+1D15A,
 *  U+2FFF, U+0301 and U+1F600. The rule refuses no character beyond the probed sets. */
const CLASSES: [RegExp, string][] = [
  [/[\u{200B}\u{FEFF}]/u, 'a zero-width space'],
  [/\p{Cc}/u, 'a control character'],
  [/\p{Co}/u, 'a private-use character'],
  [/\p{Cn}/u, 'an unassigned character'],
  [/\p{Bidi_Control}/u, 'a character that changes the text direction'],
  [/\p{Z}/u, 'a blank that is not a plain space'],
  [/[<>]/u, 'an angle bracket'],
  [/[\p{Cf}\p{Default_Ignorable_Code_Point}]/u, 'a hidden character'],
  [/[\u{2800}\u{FFFC}\u{1D159}]/u, 'a blank-like character'],
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
