// The words of a shell line, as the hooks rules read them. The tests of `hooks-command-removed-cli-flag`
// also reach this module.
import { describe, expect, it } from 'vitest'
import { commandsOf, commandWordAt, isAssignment } from '../src/shell-words.ts'

describe('commandsOf', () => {
  it('splits a line at the separators of a shell', () => {
    expect(commandsOf('a b; c | d && e & f\ng `h` (i)')).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
      ['e'],
      ['f'],
      ['g'],
      ['h'],
      ['i'],
    ])
  })

  it('joins characters in a quote or after a backslash into one word', () => {
    expect(commandsOf(`a "b c" 'd e' f\\ g "h\\"i" 'j\\k' ""`)).toEqual([
      ['a', 'b c', 'd e', 'f g', 'h"i', 'j\\k', ''],
    ])
  })

  it('joins a line that ends in a backslash, and drops a trailing backslash', () => {
    expect(commandsOf('a \\\nb\\\r\nc')).toEqual([['a', 'bc']])
    expect(commandsOf('a b\\')).toEqual([['a', 'b']])
  })

  it('gives no command for an empty line', () => {
    expect(commandsOf('')).toEqual([])
    expect(commandsOf(' ; | ')).toEqual([])
  })
})

describe('commandWordAt', () => {
  it('skips assignments and wrappers', () => {
    expect(commandWordAt(['claude'])).toBe(0)
    expect(commandWordAt(['A=1', 'exec', 'env', 'B=2', 'command', 'nohup', 'claude', 'x'])).toBe(6)
  })

  it('gives the length when only assignments and wrappers are left', () => {
    expect(commandWordAt(['A=1', 'exec'])).toBe(2)
    expect(commandWordAt([])).toBe(0)
  })

  it('reads an assignment by its name', () => {
    expect(isAssignment('A_1=x')).toBe(true)
    expect(isAssignment('1A=x')).toBe(false)
    expect(isAssignment('--a=b')).toBe(false)
  })
})
