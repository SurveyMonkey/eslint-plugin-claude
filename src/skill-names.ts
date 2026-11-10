// This module holds the name checks of the skill rules. It also holds the text that
// shows a name in a message. Each skill rule that prints a name uses `escapeName`.

/** Each class of characters that the rule refuses, with the text of the message. `markKind`
 *  gives the faults of a combining mark.
 *  The docs name the first seven classes (skills, "Characters a skill name can't hold").
 *  U+FEFF has the Unicode name ZERO WIDTH NO-BREAK SPACE, so this module counts it
 *  as a zero-width space. `kindAt` checks a plain space before it reads the classes.
 *
 *  The next two classes come from a probe of Claude Code 2.1.319. The docs give no list for
 *  them. The debug log of the probe says that a name may not hold "hidden, direction-changing
 *  or blank-like characters". Claude Code refused each of these in a project skill folder:
 *  - Each probed `Cf` character: U+00AD, U+200C, U+200D, U+2060, U+2061, U+2062, U+2063,
 *    U+180E, U+FFF9, U+FFFB, U+E0001, U+E0020, U+E0050, U+0600, U+070F, U+08E2, U+110BD,
 *    U+1BCA0, U+1BCA3, U+13430, U+1D173 and U+1D17A.
 *  - Each probed `Default_Ignorable_Code_Point` character that is not `Cf`: U+034F, U+115F,
 *    U+1160, U+17B4, U+17B5, U+180B, U+180F, U+3164, U+FFA0, U+FE00, U+FE01, U+FE0E, U+FE0F,
 *    U+E0100 and U+E01EF.
 *  - Six blank-like characters that are in neither class: U+2800, U+FFFC, U+1D159, U+13441,
 *    U+13442 and U+16FE4.
 *  Claude Code took these characters near the classes: U+2801, U+FFFD, U+2423, U+2588,
 *  U+1D158, U+1D15A, U+2FFF, U+0301, U+05D0 and U+1F600. The rule refuses each `Cf` and
 *  `Default_Ignorable_Code_Point` character, also one that the probe did not try. This is a
 *  choice of the rule. `takenAt` gives the characters of the classes that Claude Code took.
 *
 *  The last two classes come from a probe of Claude Code 2.1.322:
 *  - U+20E3. Claude Code refused it after a letter, a digit, a mark and at the start. It took
 *    U+20E3 in a keycap emoji, and took U+20DD, U+20DE, U+20DF, U+20E0, U+20E2 and U+20E4.
 *  - A lone surrogate. Claude Code could not read a `name` with the YAML escape `\uD800` or
 *    `\uDC00`. It then ignored all of the frontmatter. A folder name cannot hold one. */
const CLASSES: [RegExp, string][] = [
  [/[\u{200B}\u{FEFF}]/u, 'a zero-width space'],
  [/\p{Cc}/u, 'a control character'],
  [/\p{Co}/u, 'a private-use character'],
  [/\p{Cn}/u, 'an unassigned character'],
  [/\p{Bidi_Control}/u, 'a character that changes the text direction'],
  [/\p{Z}/u, 'a blank that is not a plain space'],
  [/[<>]/u, 'an angle bracket'],
  [/[\p{Cf}\p{Default_Ignorable_Code_Point}]/u, 'a hidden character'],
  [/[\u{2800}\u{FFFC}\u{1D159}\u{13441}\u{13442}\u{16FE4}]/u, 'a blank-like character'],
  [/\u{20E3}/u, 'a keycap mark outside a keycap emoji'],
  [/\p{Cs}/u, 'a lone surrogate'],
]

/** An emoji sequence of the RGI emoji set (UTS #51, ED-27), such as a family of people joined
 *  with U+200D. UAX #31 revision 38, section 2.3.1, says: "Implementations that allow emoji
 *  characters in identifiers should also normally allow emoji sequences." */
// biome-ignore lint/complexity/useRegexLiterals: tsc refuses a `v` literal for es2022.
const EMOJI = new RegExp('\\p{RGI_Emoji}', 'gv')

/** A combining mark (`M`), or a Hangul vowel or final jamo. The rule counts each one as a mark.
 *  The rule refuses an emoji sequence before a mark. No public source gives this limit. It is a
 *  choice of the rule, set from probes of Claude Code 2.1.319. The probes refused a red heart with
 *  U+FE0F before U+0301, and before U+1161. */
const MARK = /^[\p{M}\u{1160}-\u{11FF}\u{D7B0}-\u{D7FF}]/u

/** The most marks in a row that the rule takes. A probe of Claude Code 2.1.322 took eight marks
 *  after one letter, and refused nine. */
const MARK_LIMIT = 8

/** A skin tone. The rule refuses it after U+FE0F. This is a choice of the rule, set from a probe
 *  of Claude Code 2.1.319. It refused a name with U+261D, U+FE0F and U+1F3FB. */
const TONE = /^[\u{1F3FB}-\u{1F3FF}]/u

/** `hex` as a code point of a regular expression with the `u` flag. */
function point(hex: number): string {
  return `\\u{${hex.toString(16).toUpperCase()}}`
}

/** A joiner in an Indic word. The block of the script starts at `block`. The virama is at offset
 *  0x4D, and the nukta (Indic_Syllabic_Category Nukta) is at 0x3C. Each assigned character at
 *  0x15 to 0x39 has Indic_Syllabic_Category Consonant. The range leaves out the other consonants
 *  of the block, such as U+0958 and U+0D3A. In Malayalam, U+0D3C is a Pure_Killer and not a
 *  nukta, so the rule takes no character there. The probes of Claude Code 2.1.319 refused a
 *  joiner before U+0958 and U+0D3A, and after U+0D3C. */
function indicJoiner(block: number): string {
  const consonant = `[${point(block + 0x15)}-${point(block + 0x39)}]`
  const nukta = block === 0xd00 ? '' : `${point(block + 0x3c)}?`
  return `(?<=${consonant}${nukta}${point(block + 0x4d)})[\\u{200C}\\u{200D}](?=${consonant})`
}

/** The Sinhala consonants. Each assigned character from U+0D9A to U+0DC6 has
 *  Indic_Syllabic_Category Consonant. */
const SINHALA = '[\\u{D9A}-\\u{DC6}]'

/** The Arabic letters that the rule takes before U+200C. These are the Arabic letters from U+0620
 *  to U+08C8 with Joining_Type Dual_Joining or Left_Joining (UAX #31 revision 38, A1). The list
 *  leaves out U+10EC3 and U+10EC4. A probe of Claude Code 2.1.319 refused U+200C after U+10EC3. */
const ARABIC_BEFORE = String.raw`\u{620}\u{626}\u{628}\u{62A}-\u{62E}\u{633}-\u{63F}\u{641}-\u{647}\u{649}\u{64A}\u{66E}\u{66F}\u{678}-\u{687}\u{69A}-\u{6BF}\u{6C1}\u{6C2}\u{6CC}\u{6CE}\u{6D0}\u{6D1}\u{6FA}-\u{6FC}\u{6FF}\u{750}-\u{758}\u{75C}-\u{76A}\u{76D}-\u{770}\u{772}\u{775}-\u{777}\u{77A}-\u{77F}\u{886}\u{889}-\u{88D}\u{88F}\u{8A0}-\u{8A9}\u{8AF}\u{8B0}\u{8B3}-\u{8B8}\u{8BA}-\u{8C8}`

/** The Arabic letters that the rule takes after U+200C. These are the Arabic letters from U+0620
 *  to U+08C8 with Joining_Type Dual_Joining or Right_Joining (UAX #31 revision 38, A1). The list
 *  leaves out U+10EC2 to U+10EC4. A probe of Claude Code 2.1.319 refused U+200C before U+10EC2. */
const ARABIC_AFTER = String.raw`\u{620}\u{622}-\u{63F}\u{641}-\u{64A}\u{66E}\u{66F}\u{671}-\u{673}\u{675}-\u{6D3}\u{6D5}\u{6EE}\u{6EF}\u{6FA}-\u{6FC}\u{6FF}\u{750}-\u{77F}\u{870}-\u{882}\u{886}\u{889}-\u{88F}\u{8A0}-\u{8AC}\u{8AE}-\u{8C8}`

/** A mark between an Arabic letter and U+200C: a non-spacing mark of the Arabic or the Inherited
 *  script that is not default-ignorable. A1 of UAX #31 revision 38 takes any number of Transparent
 *  characters there. The rule takes up to eight of these marks. This is a choice of the rule, set
 *  from probes of Claude Code 2.1.319. They loaded eight marks U+064E, and refused nine. They
 *  also refused U+093C there. */
const ARABIC_MARK =
  '(?:(?=[\\p{sc=Arabic}\\p{sc=Inherited}])(?!\\p{Default_Ignorable_Code_Point})\\p{Mn})'

/** A joiner in a word of a script that needs one. UAX #31 revision 38, section 2.3.1, gives
 *  three contexts. A1 takes U+200C between two Arabic joining letters. A2 takes U+200C after a
 *  letter and a virama, before a letter. B takes U+200D after a letter and a virama, when no
 *  dependent vowel follows. The rule takes a part of these contexts. The limits are choices of
 *  the rule, set from probes of Claude Code 2.1.319:
 *  - U+200C or U+200D between two consonants of one Indic script, after the virama. The scripts
 *    are Devanagari, Bengali, Gujarati, Oriya, Telugu, Kannada and Malayalam. A nukta can come
 *    before the virama. The probes refused a joiner after a Tamil virama, before a Latin letter,
 *    before a vowel sign, and between two scripts.
 *  - U+200D between two Sinhala consonants, after the virama. A2 also takes U+200C there, but the
 *    probes refused it.
 *  - U+200C between two Arabic letters from the lists above. Up to eight marks can follow the
 *    first letter. */
const SCRIPT_JOINER = new RegExp(
  [
    ...[0x900, 0x980, 0xa80, 0xb00, 0xc00, 0xc80, 0xd00].map(indicJoiner),
    `(?<=${SINHALA}\\u{DCA})\\u{200D}(?=${SINHALA})`,
    `(?<=[${ARABIC_BEFORE}]${ARABIC_MARK}{0,8})\\u{200C}(?=[${ARABIC_AFTER}])`,
  ].join('|'),
  'gu',
)

/** True when the rule refuses the emoji sequence `sequence` before the text `rest`. A mark or a
 *  Hangul jamo after it is a fault, and so is a skin tone after U+FE0F. */
function refusedBefore(sequence: string, rest: string): boolean {
  return MARK.test(rest) || (sequence.endsWith('\u{FE0F}') && TONE.test(rest))
}

/** The indexes of `chars` that the rule takes in an emoji sequence or in a script joiner. Some of
 *  these characters are in a class of `CLASSES`, such as U+200D or U+FE0F. A probe of Claude
 *  Code 2.1.319 loaded a project skill folder with such a name. Examples are a family of people,
 *  a red heart with U+FE0F, a keycap and the flag of England. Others are a Devanagari word with
 *  U+200D after the virama, and an Arabic word with U+200C. It refused `a<U+200C>b`,
 *  `x<U+FE0F>y` and a red heart with U+FE0E. */
function takenAt(chars: string[]): Set<number> {
  const text = chars.join('')
  const taken = new Set<number>()
  for (const pattern of [EMOJI, SCRIPT_JOINER]) {
    for (const match of text.matchAll(pattern)) {
      const end = match.index + match[0].length
      if (pattern === EMOJI && refusedBefore(match[0], text.slice(end))) {
        continue
      }
      const first = [...text.slice(0, match.index)].length
      const count = [...match[0]].length
      for (let index = first; index < first + count; index++) {
        taken.add(index)
      }
    }
  }
  return taken
}

/** The fault of the mark at `index` of `chars`, or undefined. No public source gives these
 *  limits. They are choices of the rule, set from probes of Claude Code 2.1.322. The base is the
 *  character before the run of marks.
 *  - The base must be a letter or a number (`L` or `N`). The probes refused a mark at the start.
 *    They also refused a mark after a space, `-`, `.`, `_`, `:`, `!`, `$`, `^`, U+FFFD and U+1F600.
 *  - A run of more than eight marks is a fault. See `MARK_LIMIT`.
 *  - A mark outside the Inherited script is a fault after a base of the Latin or the Common
 *    script. The probes refused U+05B8, U+093F, U+0483, U+1161 and U+1D165 after `a`. They
 *    refused U+093F after `1`, U+00B2 and U+FF41. They took each Inherited mark after `a`, such
 *    as U+0301 and U+064B. They took each probed mark after a letter that is not Latin. Examples
 *    are U+093F after U+0995, and U+0483 after U+03B1. */
function markKind(chars: string[], index: number): string | undefined {
  const char = chars[index] as string
  if (!MARK.test(char)) {
    return undefined
  }
  let start = index
  while (start > 0 && MARK.test(chars[start - 1] as string)) {
    start--
  }
  const base = chars[start - 1] ?? ''
  if (!/^[\p{L}\p{N}]$/u.test(base)) {
    return 'a combining mark with no letter or number before it'
  }
  if (index - start >= MARK_LIMIT) {
    return 'more than eight combining marks in a row'
  }
  return /^[\p{sc=Latin}\p{sc=Common}]$/u.test(base) && !/^\p{sc=Inherited}$/u.test(char)
    ? 'a combining mark outside the Inherited script, after a Latin or Common character'
    : undefined
}

/** The text of the class of the character at `index` of `chars`, or
 *  undefined when Claude Code takes the character. A plain space is a fault
 *  at the start or the end, or before another space. A mark is a fault in the
 *  cases of `markKind`. `taken` is the result of `takenAt`. */
function kindAt(chars: string[], index: number, taken: Set<number>): string | undefined {
  const char = chars[index] as string
  if (taken.has(index)) {
    return undefined
  }
  if (char !== ' ') {
    return CLASSES.find(([pattern]) => pattern.test(char))?.[1] ?? markKind(chars, index)
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
