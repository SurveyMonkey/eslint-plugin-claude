// This module holds the name checks of the skill rules. It also holds the text that
// shows a name in a message. Each skill rule that prints a name uses `escapeName`.

/** Each class of characters that the rule refuses, with the text of the message.
 *  The docs name the first seven classes (skills, "Characters a skill name can't hold").
 *  U+FEFF has the Unicode name ZERO WIDTH NO-BREAK SPACE, so this module counts it
 *  as a zero-width space. `kindAt` checks a plain space before it reads the classes.
 *
 *  The last two classes come from a probe of Claude Code 2.1.319. The docs give no list for
 *  them. The debug log of the probe says that a name may not hold "hidden, direction-changing
 *  or blank-like characters". Claude Code refused each of these in a project skill folder:
 *  - Each probed `Cf` character: U+00AD, U+200C, U+200D, U+2060, U+2061, U+2062, U+2063,
 *    U+180E, U+FFF9, U+FFFB, U+E0001, U+E0020, U+E0050, U+0600, U+070F, U+08E2, U+110BD,
 *    U+1BCA0, U+1BCA3, U+13430, U+1D173 and U+1D17A.
 *  - Each probed `Default_Ignorable_Code_Point` character that is not `Cf`: U+034F, U+115F,
 *    U+1160, U+17B4, U+17B5, U+180B, U+180F, U+3164, U+FFA0, U+FE00, U+FE01, U+FE0E, U+FE0F,
 *    U+E0100 and U+E01EF.
 *  - Three blank-like characters that are in neither class: U+2800, U+FFFC and U+1D159.
 *  Claude Code took these characters near the classes: U+2801, U+FFFD, U+2423, U+2588,
 *  U+1D158, U+1D15A, U+2FFF, U+0301, U+05D0 and U+1F600. The rule refuses each `Cf` and
 *  `Default_Ignorable_Code_Point` character, also one that the probe did not try. This is a
 *  choice of the rule. `takenAt` gives the joiners that Claude Code took in the probe. */
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

/** An emoji sequence of Unicode, such as a family of people joined with U+200D. */
// biome-ignore lint/complexity/useRegexLiterals: the target is es2022, and tsc refuses a `v` literal.
const EMOJI = new RegExp('\\p{RGI_Emoji}', 'gv')

/** A joiner in a word of a script that needs one. The rule takes U+200C or U+200D after a
 *  virama of Devanagari, Bengali, Gujarati, Oriya, Telugu, Kannada or Malayalam, before a letter.
 *  It takes U+200D after the Sinhala virama, and U+200C between two Arabic letters. */
const SCRIPT_JOINER = new RegExp(
  [
    '(?<=[\\u{94D}\\u{9CD}\\u{ACD}\\u{B4D}\\u{C4D}\\u{CCD}\\u{D4D}])[\\u{200C}\\u{200D}](?=\\p{L})',
    '(?<=\\u{DCA})\\u{200D}(?=\\p{L})',
    '(?<=(?=\\p{sc=Arabic})\\p{L}\\p{Mn}{0,8})\\u{200C}(?=(?=\\p{sc=Arabic})\\p{L})',
  ].join('|'),
  'gu',
)

/** The indexes of `chars` that Claude Code 2.1.319 took in a probe, though they are in a class
 *  of `CLASSES`. The probe loaded a project skill folder with an emoji sequence, such as a family
 *  of people, a red heart with U+FE0F, a keycap and the flag of England. It also loaded a
 *  Devanagari word with U+200D after the virama, and an Arabic word with U+200C. It refused
 *  `a<U+200C>b`, `x<U+FE0F>y` and a red heart with U+FE0E. */
function takenAt(chars: string[]): Set<number> {
  const text = chars.join('')
  const taken = new Set<number>()
  for (const pattern of [EMOJI, SCRIPT_JOINER]) {
    for (const match of text.matchAll(pattern)) {
      const first = [...text.slice(0, match.index)].length
      const count = [...match[0]].length
      for (let index = first; index < first + count; index++) {
        taken.add(index)
      }
    }
  }
  return taken
}

/** The text of the class of the character at `index` of `chars`, or
 *  undefined when Claude Code takes the character. A plain space is a fault
 *  at the start or the end, or before another space. `taken` is the result of `takenAt`. */
function kindAt(chars: string[], index: number, taken: Set<number>): string | undefined {
  const char = chars[index] as string
  if (taken.has(index)) {
    return undefined
  }
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
  const taken = takenAt(chars)
  for (const [index, char] of chars.entries()) {
    const kind = kindAt(chars, index, taken)
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
  const taken = takenAt(chars)
  return chars
    .map((char, index) => (kindAt(chars, index, taken) === undefined ? char : `<${codeOf(char)}>`))
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
  const taken = takenAt(chars)
  return chars
    .map((char, index) =>
      kindAt(chars, index, taken) === undefined && !besideBlank(chars, index) ? char : '-',
    )
    .join('')
}
