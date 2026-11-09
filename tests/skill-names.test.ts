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
  ])('refuses %s', (_name, text, code) => {
    expect(firstFault(text)).toEqual({ code, kind: 'a hidden character' })
  })
})

// The docs say that the refused characters of a plugin skill folder become hyphens. `hyphenate`
// changes each one to one hyphen. It also changes a plain space next to another blank. Other
// characters stay.
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
    // A private-use character above U+FFFF is one character, so it gives one hyphen.
    ['a\u{F0000}b', 'a-b'],
    [' a', '-a'],
    ['a ', 'a-'],
    ['a b', 'a b'],
    // The docs refuse a blank other than one plain space between words. The rule reads this as:
    // each space of a run of blanks becomes a hyphen.
    ['a  b', 'a--b'],
    ['a   b', 'a---b'],
    ['a  ', 'a--'],
    ['  a', '--a'],
    ['a\u{A0} b', 'a--b'],
    ['a \u{A0}b', 'a--b'],
    // An angle bracket is not a blank. A plain space next to it stays.
    ['a< b', 'a- b'],
    // The docs do not name a dot, so it stays.
    ['a.b', 'a.b'],
    // Claude Code 2.1.319 loaded a plugin folder of soft hyphens as `-`, and two as `--`. It
    // loaded `a\u{AD}b` as `a-b`, `x\u{2800}y` as `x-y` and `x\u{200D}y` as `x-y`.
    ['\u{AD}', '-'],
    ['\u{AD}\u{AD}', '--'],
    ['a\u{AD}b', 'a-b'],
    ['x\u{2800}y', 'x-y'],
    ['x\u{200D}y', 'x-y'],
  ])('gives %j as %j', (text, loaded) => {
    expect(hyphenate(text)).toBe(loaded)
  })
})
