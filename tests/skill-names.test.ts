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
})

// The docs say that the refused characters of a plugin skill folder become hyphens. Each one
// becomes one hyphen. Other characters stay.
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
    // A private-use character outside the first plane is one character, so it gives one hyphen.
    ['a\u{F0000}b', 'a-b'],
    [' a', '-a'],
    ['a ', 'a-'],
    ['a b', 'a b'],
    // Of two spaces, the first is before another space, so it is the refused one.
    ['a  b', 'a- b'],
    // The docs do not name a dot, so it stays.
    ['a.b', 'a.b'],
  ])('gives %j as %j', (text, loaded) => {
    expect(hyphenate(text)).toBe(loaded)
  })
})
