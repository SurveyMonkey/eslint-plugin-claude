// The name faults and the escaped text. Two rules share the faults. Every rule that prints a name shares the text.
import { describe, expect, it } from 'vitest'
import { escapeName, firstFault, hyphenate } from '../src/skill-names.ts'

describe('escapeName', () => {
  it.each([
    ['deploy', 'deploy'],
    ['my deploy', 'my deploy'],
    ['', ''],
    ['a‮b', 'a<U+202E>b'],
    ['a​b', 'a<U+200B>b'],
    ['a\u{F0000}b', 'a<U+F0000>b'],
    ['a<b>', 'a<U+003C>b<U+003E>'],
    [' a', '<U+0020>a'],
    ['a ', 'a<U+0020>'],
    ['a  b', 'a<U+0020> b'],
    ['a   b', 'a<U+0020><U+0020> b'],
    // A literal `<U+200B>` stays distinct from an escaped U+200B, because `<` is escaped too.
    ['<U+200B>', '<U+003C>U+200B<U+003E>'],
  ])('prints %j as %j', (text, shown) => {
    expect(escapeName(text)).toBe(shown)
  })
})

describe('firstFault', () => {
  it('gives the first refused character only', () => {
    expect(firstFault('a‮​b')).toEqual({
      code: 'U+202E',
      kind: 'a character that changes the text direction',
    })
  })

  it('gives null for a plain name', () => {
    expect(firstFault('my deploy')).toBeNull()
  })

  // Claude Code 2.1.319 refused a project skill folder `x<c>y` for each of these code points.
  // The debug log said: a name may not hold hidden, direction-changing or blank-like characters.
  // The first 14 are the characters of issue #589. The others are probed neighbours in the class.
  it.each([
    ['U+00AD', 'a hidden character'],
    ['U+200C', 'a hidden character'],
    ['U+200D', 'a hidden character'],
    ['U+2060', 'a hidden character'],
    ['U+180E', 'a hidden character'],
    ['U+FFF9', 'a hidden character'],
    ['U+E0001', 'a hidden character'],
    ['U+0600', 'a hidden character'],
    ['U+110BD', 'a hidden character'],
    ['U+2061', 'a hidden character'],
    ['U+034F', 'a hidden character'],
    ['U+FE00', 'a hidden character'],
    ['U+115F', 'a hidden character'],
    ['U+3164', 'a hidden character'],
    ['U+FE0F', 'a hidden character'],
    ['U+1160', 'a hidden character'],
    ['U+E01EF', 'a hidden character'],
    ['U+2063', 'a hidden character'],
    ['U+E0050', 'a hidden character'],
    ['U+1BCA0', 'a hidden character'],
    ['U+13430', 'a hidden character'],
    ['U+1D173', 'a hidden character'],
    ['U+FFA0', 'a hidden character'],
    ['U+FE01', 'a hidden character'],
    ['U+FE0E', 'a hidden character'],
    ['U+E0100', 'a hidden character'],
    ['U+2800', 'a blank-like character'],
    ['U+FFFC', 'a blank-like character'],
    ['U+1D159', 'a blank-like character'],
    ['U+13441', 'a blank-like character'],
    ['U+13442', 'a blank-like character'],
    ['U+16FE4', 'a blank-like character'],
  ])('refuses %s as %s', (code, kind) => {
    const char = String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    expect(firstFault(`x${char}y`)).toEqual({ code, kind })
  })

  // Claude Code 2.1.319 took a folder `x<c>y` for each of these code points.
  it.each([
    '\u{2801}',
    '\u{FFFD}',
    '\u{2423}',
    '\u{2588}',
    '\u{1D158}',
    '\u{1D15A}',
    '\u{301}',
    '\u{1F600}',
    '\u{2FFF}',
    '\u{5D0}',
  ])('takes %j', (char) => {
    expect(firstFault(`x${char}y`)).toBeNull()
  })

  // Claude Code 2.1.319 took a project skill folder with each of these names. Each holds a
  // character of the hidden class in an emoji sequence, or a joiner in a word of a script.
  it.each([
    ['a family emoji', 'family-\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'],
    ['a red heart with U+FE0F', 'x\u2764\uFE0Fy'],
    ['a keycap', 'x1\uFE0F\u20E3y'],
    ['the flag of England', 'x\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}y'],
    ['a Devanagari U+200D', '\u0915\u094D\u200D\u0937'],
    ['a Bengali U+200C', '\u0995\u09CD\u200C\u09B7'],
    ['a Sinhala U+200D', '\u0DA4\u0DCA\u200D\u0DBA'],
    ['an Arabic U+200C', '\u0628\u200C\u0628'],
    ['an Arabic U+200C after a mark', '\u0628\u064E\u200C\u0628'],
    [
      'two family emoji',
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
    ],
    ['an Arabic U+200C after an emoji', 'x\u{1F600}\u0628\u200C\u0628'],
    ['a Devanagari U+200D after a nukta', '\u0915\u093C\u094D\u200D\u0915'],
    ['a Gujarati U+200D', '\u0A95\u0ACD\u200D\u0AB7'],
    ['an Oriya U+200C', '\u0B15\u0B4D\u200C\u0B37'],
    ['a Telugu U+200D', '\u0C15\u0C4D\u200D\u0C37'],
    ['a Kannada U+200C', '\u0C95\u0CCD\u200C\u0CB7'],
    ['a Malayalam U+200D', '\u0D15\u0D4D\u200D\u0D37'],
    ['an Arabic U+200C after eight marks', `\u0628${'\u064E'.repeat(8)}\u200C\u0628`],
    ['an Arabic U+200C after a mark of the Inherited script', '\u0628\u0300\u200C\u0628'],
  ])('takes %s', (_name, text) => {
    expect(firstFault(text)).toBeNull()
  })

  // Claude Code 2.1.319 refused a project skill folder with each of these names.
  it.each([
    ['a red heart with U+FE0E', 'x\u2764\uFE0Ey', 'U+FE0E'],
    ['U+200C between Latin letters', 'a\u200Cb', 'U+200C'],
    ['U+200D after a Tamil virama', '\u0B95\u0BCD\u200D\u0BB7', 'U+200D'],
    ['U+200D at the end of an emoji', 'x\u{1F468}\u200D', 'U+200D'],
    ['U+200C after an Arabic letter at the end', '\u0628\u200C', 'U+200C'],
    ['U+200D after a Devanagari virama at the end', '\u0915\u094D\u200D', 'U+200D'],
    ['U+200C between a Latin and an Arabic letter', 'a\u200C\u0628', 'U+200C'],
    ['U+200C between an Arabic and a Latin letter', '\u0628\u200Ca', 'U+200C'],
    ['U+200C after an alef', '\u0627\u200C\u0628', 'U+200C'],
    ['U+200C before a hamza', '\u0628\u200C\u0621', 'U+200C'],
    ['U+200C after an Arabic digit', '\u0663\u200C\u0628', 'U+200C'],
    ['U+200D between two Arabic letters', '\u0628\u200D\u0628', 'U+200D'],
    ['U+200D between a Devanagari virama and a Latin letter', '\u0915\u094D\u200Da', 'U+200D'],
    ['U+200D after a Devanagari virama on a vowel', '\u0905\u094D\u200D\u0915', 'U+200D'],
    ['U+200D between Devanagari and Bengali', '\u0915\u094D\u200D\u0995', 'U+200D'],
    ['U+200C between a Malayalam virama and a Latin letter', '\u0D15\u0D4D\u200Ca', 'U+200C'],
    ['U+200D before a Bengali virama', '\u09B0\u200D\u09CD\u09AF', 'U+200D'],
    ['U+200D after a Malayalam virama at the end', 'x\u0D28\u0D4D\u200D', 'U+200D'],
    ['U+200D between a Sinhala virama and a Latin letter', '\u0D9A\u0DCA\u200Da', 'U+200D'],
    ['U+200C after a Sinhala virama', '\u0DA4\u0DCA\u200C\u0DBA', 'U+200C'],
    ['U+200C after a Devanagari mark on an Arabic letter', 'x\u0628\u093C\u200C\u0628y', 'U+200C'],
    ['a red heart with U+FE0F before a mark', 'x\u2764\uFE0F\u0301y', 'U+FE0F'],
    ['a red heart with U+FE0F before a Hangul jamo', 'x\u2764\uFE0F\u1161y', 'U+FE0F'],
    ['U+FE0F before a skin tone', 'x\u261D\uFE0F\u{1F3FB}y', 'U+FE0F'],
    // Claude Code 2.1.322 refused these joiner cases too.
    ['U+200D before U+0958', '\u0915\u094D\u200D\u0958', 'U+200D'],
    ['U+200D before U+0D3A', '\u0D15\u0D4D\u200D\u0D3A', 'U+200D'],
    ['U+200D after a Malayalam U+0D3C and virama', '\u0D15\u0D3C\u0D4D\u200D\u0D15', 'U+200D'],
    ['U+200C after U+10EC3', '\u{10EC3}\u200C\u0628', 'U+200C'],
    ['U+200C before U+10EC2', '\u0628\u200C\u{10EC2}', 'U+200C'],
    ['U+200D before a Devanagari vowel sign', '\u0915\u094D\u200D\u093F', 'U+200D'],
    ['U+200C before a Devanagari vowel sign', '\u0915\u094D\u200C\u093F', 'U+200C'],
  ])('refuses %s', (_name, text, code) => {
    expect(firstFault(text)).toEqual({ code, kind: 'a hidden character' })
  })

  // Claude Code 2.1.319 refused these names. The virama has a Latin letter before it, so the rule
  // reports the virama first. The joiner is not in a word of a script, so the rule refuses it too.
  it.each([
    ['a Sinhala virama', 'x\u0DCA\u200D\u0D9Ay', 'x<U+0DCA><U+200D>\u0D9Ay'],
    ['a Devanagari virama', 'x\u094D\u200D\u0915y', 'x<U+094D><U+200D>\u0915y'],
  ])('refuses U+200D after %s with no consonant', (_name, text, shown) => {
    expect(escapeName(text)).toBe(shown)
  })

  // Claude Code 2.1.319 refused U+200C after nine Arabic marks. The rule reports the ninth mark
  // first. The joiner is not in an Arabic word, so the rule refuses it too.
  it('refuses U+200C after nine Arabic marks', () => {
    expect(escapeName(`\u0628${'\u064E'.repeat(9)}\u200C\u0628`)).toBe(
      `\u0628${'\u064E'.repeat(8)}<U+064E><U+200C>\u0628`,
    )
  })

  // The run of marks is long. The rule must report each mark after the eighth.
  it('refuses each mark after the eighth of a long run', () => {
    expect(escapeName(`a${'\u0301'.repeat(11)}`)).toBe(
      `a${'\u0301'.repeat(8)}${'<U+0301>'.repeat(3)}`,
    )
  })

  // With no limit on the walk of `markKind`, the cost is quadratic. 30000 marks then took about
  // 10 seconds. The timeout catches that case.
  it('escapes a very long run of marks in linear time', () => {
    const text = `a${'\u0301'.repeat(30000)}`
    expect(escapeName(text)).toBe(`a${'\u0301'.repeat(8)}${'<U+0301>'.repeat(29992)}`)
  }, 3000)

  // Claude Code 2.1.322 refused a project skill folder with each of these names. Its debug log
  // said `<name> is not offered`. U+20E3 loaded only in a keycap emoji.
  const KEYCAP = 'a keycap mark outside a keycap emoji'
  const NO_BASE = 'a combining mark with no letter or number before it'
  const TOO_MANY = 'more than eight combining marks in a row'
  const SCRIPT = 'a combining mark outside the Inherited script, after a Latin or Common character'
  it.each([
    ['U+20E3 between two letters', 'a\u20E3b', 'U+20E3', KEYCAP],
    ['U+20E3 after a digit with no U+FE0F', 'x1\u20E3y', 'U+20E3', KEYCAP],
    ['U+20E3 after an asterisk with no U+FE0F', 'x*\u20E3y', 'U+20E3', KEYCAP],
    ['U+20E3 at the start', '\u20E3ab', 'U+20E3', KEYCAP],
    ['U+20E3 at the end', 'ab\u20E3', 'U+20E3', KEYCAP],
    ['U+20E3 after a CJK letter', '\u65E5\u20E3b', 'U+20E3', KEYCAP],
    ['U+20E3 after U+20DD', 'a\u20DD\u20E3b', 'U+20E3', KEYCAP],
    ['U+20E3 after seven marks', `a${'\u0301'.repeat(7)}\u20E3b`, 'U+20E3', KEYCAP],
    ['U+0301 at the start', '\u0301ab', 'U+0301', NO_BASE],
    ['U+0301 after a space', 'a \u0301b', 'U+0301', NO_BASE],
    ['U+0301 after a hyphen', 'a-\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after a dot', 'a.\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after an underscore', 'a_\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after a colon', 'a:\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after an exclamation mark', 'a!\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after a dollar sign', 'a$\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after a circumflex accent', 'a^\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after U+FFFD', 'a\uFFFD\u0301b', 'U+0301', NO_BASE],
    ['U+0301 after an emoji', 'x\u{1F600}\u0301y', 'U+0301', NO_BASE],
    ['a Devanagari vowel sign at the start', '\u093Eab', 'U+093E', NO_BASE],
    ['a Thai vowel sign at the start', '\u0E34ab', 'U+0E34', NO_BASE],
    ['a Hangul vowel jamo at the start', '\u1161ab', 'U+1161', NO_BASE],
    ['a Devanagari vowel sign after a danda', '\u0915\u0964\u093Fb', 'U+093F', NO_BASE],
    ['U+064E after an Arabic comma', '\u0628\u060C\u064Eb', 'U+064E', NO_BASE],
    ['nine U+0301', `a${'\u0301'.repeat(9)}b`, 'U+0301', TOO_MANY],
    [
      'nine different marks',
      'a\u0300\u0301\u0302\u0303\u0304\u0306\u0307\u0308\u0309b',
      'U+0309',
      TOO_MANY,
    ],
    ['nine U+0301 after a CJK letter', `\u65E5${'\u0301'.repeat(9)}b`, 'U+0301', TOO_MANY],
    ['nine U+0902 after a Devanagari letter', `\u0915${'\u0902'.repeat(9)}`, 'U+0902', TOO_MANY],
    ['nine U+0903 after a Devanagari letter', `\u0915${'\u0903'.repeat(9)}`, 'U+0903', TOO_MANY],
    ['nine U+064E between Arabic letters', `\u0628${'\u064E'.repeat(9)}\u0628`, 'U+064E', TOO_MANY],
    // Claude Code 2.1.319 refused this name. The rule reports the ninth mark before the joiner.
    [
      'U+200C after nine Arabic marks',
      `\u0628${'\u064E'.repeat(9)}\u200C\u0628`,
      'U+064E',
      TOO_MANY,
    ],
    ['a Hebrew point after a Latin letter', 'a\u05B8b', 'U+05B8', SCRIPT],
    ['a Devanagari vowel sign after a Latin letter', 'a\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari spacing mark after a Latin letter', 'a\u0903b', 'U+0903', SCRIPT],
    ['an Arabic mark after a Latin letter', 'a\u06D6b', 'U+06D6', SCRIPT],
    ['U+0483 after a Latin letter', 'a\u0483b', 'U+0483', SCRIPT],
    ['U+0483 after a Latin letter and U+0301', 'a\u0301\u0483b', 'U+0483', SCRIPT],
    ['U+0489 after a Latin letter', 'a\u0489b', 'U+0489', SCRIPT],
    ['U+A670 after a Latin letter', 'a\uA670b', 'U+A670', SCRIPT],
    ['a Hangul vowel jamo after a Latin letter', 'a\u1161b', 'U+1161', SCRIPT],
    ['a Hangul final jamo after a Latin letter', 'a\u11A8b', 'U+11A8', SCRIPT],
    ['U+D7B0 after a Latin letter', 'a\uD7B0b', 'U+D7B0', SCRIPT],
    ['a Hangul vowel jamo after U+00E9', '\u00E9\u1161b', 'U+1161', SCRIPT],
    ['a Devanagari vowel sign after U+00E9', '\u00E9\u093Fb', 'U+093F', SCRIPT],
    ['U+0483 after U+00DF', '\u00DF\u0483b', 'U+0483', SCRIPT],
    ['a Devanagari vowel sign after U+1E00', '\u1E00\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari vowel sign after a full-width Latin letter', '\uFF41\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari vowel sign after U+216B', '\u216B\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari vowel sign after an ASCII digit', '1\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari vowel sign after a full-width digit', '\uFF11\u093Fb', 'U+093F', SCRIPT],
    ['a Devanagari vowel sign after U+00B2', '\u00B2\u093Fb', 'U+093F', SCRIPT],
    ['U+1CE1 after a Latin letter', 'a\u1CE1b', 'U+1CE1', SCRIPT],
    ['U+1D165 after a Latin letter', 'a\u{1D165}b', 'U+1D165', SCRIPT],
    ['U+1D165 after a digit', '1\u{1D165}b', 'U+1D165', SCRIPT],
  ])('refuses %s', (_name, text, code, kind) => {
    expect(firstFault(text)).toEqual({ code, kind })
  })

  // Claude Code 2.1.322 took a project skill folder with each of these names.
  it.each([
    ['two U+0301', 'a\u0301\u0301b'],
    ['eight U+0301', `a${'\u0301'.repeat(8)}b`],
    ['eight different marks', 'a\u0300\u0301\u0302\u0303\u0304\u0306\u0307\u0308b'],
    ['eight U+064E between Arabic letters', `\u0628${'\u064E'.repeat(8)}\u0628`],
    ['eight U+0902 after a Devanagari letter', `\u0915${'\u0902'.repeat(8)}`],
    ['eight U+0903 after a Devanagari letter', `\u0915${'\u0903'.repeat(8)}`],
    ['eight Devanagari marks', '\u0915\u093C\u093F\u0902\u0903\u0901\u0900\u093A\u093B'],
    ['U+0301 at the end', 'ab\u0301'],
    ['U+0301 after a digit', 'a1\u0301b'],
    ['U+0301 after U+00B2', 'a\u00B2\u0301b'],
    ['U+0301 after U+216B', 'a\u216B\u0301b'],
    ['U+0301 after a CJK letter', '\u65E5\u0301b'],
    ['U+0301 after a Hebrew letter', '\u05D0\u0301b'],
    ['U+0301 after a Greek letter', '\u03B1\u0301b'],
    ['U+0301 after a Cyrillic letter', '\u0430\u0301b'],
    ['U+0301 after a modifier letter', '\u02B0\u0301b'],
    ['U+0301 after a title-case letter', '\u01C5\u0301b'],
    ['U+20DD after a Latin letter', 'a\u20DDb'],
    ['U+20DE after a Latin letter', 'a\u20DEb'],
    ['U+20DF after a Latin letter', 'a\u20DFb'],
    ['U+20E0 after a Latin letter', 'a\u20E0b'],
    ['U+20E2 after a Latin letter', 'a\u20E2b'],
    ['U+20E4 after a Latin letter', 'a\u20E4b'],
    ['U+20D0 after a Latin letter', 'a\u20D0b'],
    ['U+1ABE after a Latin letter', 'a\u1ABEb'],
    ['U+064B after a Latin letter', 'a\u064Bb'],
    ['U+0670 after a Latin letter', 'a\u0670b'],
    ['U+1CD0 after a Latin letter', 'a\u1CD0b'],
    ['U+0951 after a Latin letter', 'a\u0951b'],
    ['a keycap of U+0023', 'x#\uFE0F\u20E3y'],
    ['a keycap of U+0031', 'x1\uFE0F\u20E3y'],
    ['a Hebrew point after a Hebrew letter', '\u05D0\u05B8b'],
    ['a Devanagari vowel sign after a Devanagari letter', '\u0915\u093F'],
    ['three Devanagari marks', '\u0915\u093C\u0940\u0902'],
    ['an Arabic mark after an Arabic letter', '\u0628\u064E'],
    ['U+0488 after a Cyrillic letter', '\u0430\u0488b'],
    ['U+0489 after a Cyrillic letter', '\u0430\u0489b'],
    ['U+A670 after a Cyrillic letter', '\u0430\uA670b'],
    ['U+0483 after a Cyrillic letter and U+0301', '\u0430\u0301\u0483b'],
    ['U+0483 after a Cyrillic letter', '\u0430\u0483b'],
    ['a Japanese voice mark after a kana', '\u3042\u3099b'],
    ['a Japanese voice mark after a CJK letter', '\u65E5\u3099b'],
    ['a Thai vowel sign after a Thai letter', '\u0E01\u0E34b'],
    ['a Hangul vowel jamo after a lead jamo', '\u1100\u1161b'],
    ['a Hangul final jamo after a syllable', '\uAC00\u11A8b'],
    ['a Hangul vowel jamo after a syllable', '\uAC00\u1161b'],
    ['a Devanagari vowel sign after a joiner word', '\u0915\u094D\u200D\u0915\u093F'],
    ['a Devanagari vowel sign after a Devanagari digit', '\u0967\u093Fb'],
    ['a Devanagari vowel sign after an Arabic digit', '\u0663\u093Fb'],
    ['U+0483 after a Greek letter', '\u03B1\u0483b'],
    ['a Hebrew point after an Arabic letter', '\u0628\u05B8b'],
    ['an Arabic mark after a Hebrew letter', '\u05D0\u06D6b'],
    ['an Arabic mark after a Syriac letter', '\u0710\u06D6b'],
    ['a Syriac mark after an Arabic letter', '\u0628\u0730b'],
    ['a Devanagari vowel sign after a Tamil letter', '\u0B95\u093Fb'],
    ['a Devanagari vowel sign after a Bengali letter', '\u0995\u093Fb'],
    ['a Bengali vowel sign after a Devanagari letter', '\u0915\u09BFb'],
    ['a Tamil vowel sign after a Devanagari letter', '\u0915\u0BBFb'],
    ['a Thai vowel sign after a Devanagari letter', '\u0915\u0E34b'],
    ['a Devanagari nukta after a Bengali letter', '\u0995\u093Cb'],
    ['a Devanagari nukta after a Gurmukhi letter', '\u0A15\u093Cb'],
    ['a Devanagari nukta after a Tamil letter', '\u0B95\u093Cb'],
    ['a Devanagari vowel sign after a CJK letter', '\u65E5\u093Fb'],
    ['U+0483 after a CJK letter', '\u65E5\u0483b'],
    ['a Hangul vowel jamo after a CJK letter', '\u65E5\u1161b'],
  ])('takes %s', (_name, text) => {
    expect(firstFault(text)).toBeNull()
  })
})

// The docs say that the refused characters of a plugin skill folder become hyphens. Probes of
// Claude Code 2.1.319 and 2.1.322 (`claude -p --plugin-dir`, the init message) gave the values that
// a comment names. Each UTF-16 code unit that is not an ASCII letter, an ASCII digit, `_` or `-`
// became one hyphen. The other values come from that probed rule.
describe('hyphenate', () => {
  it.each([
    ['deploy', 'deploy'],
    ['', ''],
    ['a<b', 'a-b'],
    ['a>b', 'a-b'],
    ['a<<b', 'a--b'],
    ['a\u{200B}b', 'a-b'],
    ['a\u{A0}b', 'a-b'],
    ['a\u{202E}b', 'a-b'],
    ['a\tb', 'a-b'],
    // A private-use character above U+FFFF is two UTF-16 code units, so it gives two hyphens.
    ['a\u{F0000}b', 'a--b'],
    [' a', '-a'],
    ['a ', 'a-'],
    // Claude Code 2.1.322 loaded a plugin folder `a b` as `a-b`, and `a< b` as `a--b`.
    ['a b', 'a-b'],
    ['a  b', 'a--b'],
    ['a   b', 'a---b'],
    ['a  ', 'a--'],
    ['  a', '--a'],
    ['a\u{A0} b', 'a--b'],
    ['a \u{A0}b', 'a--b'],
    ['a< b', 'a--b'],
    // Claude Code 2.1.322 loaded a plugin folder `a.b` as `a-b`.
    ['a.b', 'a-b'],
    // Claude Code 2.1.319 loaded a plugin folder of soft hyphens as `-`, and two as `--`. It
    // loaded `a\u{AD}b` as `a-b`, `x\u{2800}y` as `x-y` and `x\u{200D}y` as `x-y`.
    ['\u{AD}', '-'],
    ['\u{AD}\u{AD}', '--'],
    ['a\u{AD}b', 'a-b'],
    ['x\u{2800}y', 'x-y'],
    ['x\u{200D}y', 'x-y'],
    // The three folders of the 2.1.319 probe, again on 2.1.322. The family emoji is eight code
    // units. The Devanagari word is four, and the red heart with U+FE0F is two.
    ['family-\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}', 'family---------'],
    ['\u{915}\u{94D}\u{200D}\u{937}', '----'],
    ['x\u{2764}\u{FE0F}y', 'x--y'],
    ['a\u{34F}b', 'a-b'],
    ['a\u{3164}b', 'a-b'],
    // A character that Claude Code takes in a project folder becomes a hyphen in a plugin folder.
    // Claude Code 2.1.322 also loaded `\u{FF46}\u{FF4F}\u{FF4F}` as `---`, and `\u{661}\u{662}`
    // as `--`.
    ['caf\u{E9}', 'caf-'],
    ['cafe\u{301}', 'cafe-'],
    ['\u{3B1}', '-'],
    ['\u{65E5}\u{672C}', '--'],
    ['x\u{1F600}y', 'x--y'],
    ['\u{FF46}\u{FF4F}\u{FF4F}', '---'],
    ['\u{661}\u{662}', '--'],
    // The kinds of combining mark that `firstFault` refuses, and eight marks that it takes, in a
    // plugin folder.
    ['\u{301}ab', '-ab'],
    [`a${'\u{301}'.repeat(8)}b`, 'a--------b'],
    [`a${'\u{301}'.repeat(9)}b`, 'a---------b'],
    ['a\u{93F}b', 'a-b'],
    ['a\u{20E3}b', 'a-b'],
    ['\u{20E3}', '-'],
    // Claude Code 2.1.322 kept the letter case, the digits and `_`.
    ['ABC', 'ABC'],
    ['a_b', 'a_b'],
    ['a0b', 'a0b'],
  ])('gives %j as %j', (text, loaded) => {
    expect(hyphenate(text)).toBe(loaded)
  })

  // Claude Code 2.1.322 loaded a plugin folder `a<c>b` for each printable ASCII character `c`
  // other than `/`. These are the characters that it kept.
  const KEPT = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
  it.each(
    Array.from({ length: 0x7f - 0x20 }, (_, index) => String.fromCharCode(0x20 + index)).filter(
      (char) => char !== '/',
    ),
  )('gives a%sb as Claude Code 2.1.322 does', (char) => {
    expect(hyphenate(`a${char}b`)).toBe(KEPT.includes(char) ? `a${char}b` : 'a-b')
  })

  // A `hyphenate` that does one replace for each mark takes quadratic time. For this run, that is
  // more than one minute, so the timeout fails it. One replace of all marks takes some milliseconds.
  it('changes a very long run of marks in linear time', () => {
    expect(hyphenate(`a${'\u0301'.repeat(300000)}b`)).toBe(`a${'-'.repeat(300000)}b`)
  }, 3000)
})
