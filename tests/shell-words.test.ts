// The words of a shell line, as the hooks rules read them. The tests of `hooks-command-removed-cli-flag`
// also reach this module.
import { describe, expect, it } from 'vitest'
import {
  commandsOf,
  commandWordAt,
  isAssignment,
  isPrinter,
  printedBy,
  sinkOf,
} from '../src/shell-words.ts'

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

describe('sinkOf', () => {
  const sink = (line: string, index = 0) => sinkOf(commandsOf(line), index)

  it('gives stdout for a command with no redirect of standard output', () => {
    expect(sink('echo a')).toBe('stdout')
    expect(sink('echo a 2>/dev/null')).toBe('stdout')
    expect(sink('echo a 2>&1')).toBe('stdout')
    expect(sink('echo a >&1')).toBe('stdout')
  })

  it('gives stderr for a redirect to descriptor 2 or to /dev/stderr', () => {
    for (const line of [
      'echo a >&2',
      'echo a 1>&2',
      'echo a >/dev/stderr',
      'echo a > /dev/stderr',
    ]) {
      expect(sink(line), line).toBe('stderr')
    }
  })

  it('gives other for a redirect to a file or to another descriptor', () => {
    for (const line of ['echo a > f', 'echo a >f', 'echo a >> f', 'echo a 1>f', 'echo a >&3']) {
      expect(sink(line), line).toBe('other')
    }
  })

  it('reads the command at the index', () => {
    expect(sink('echo a >&2; echo b', 2)).toBe('stdout')
    expect(sink('echo a; echo b >&2', 1)).toBe('stderr')
  })
})

describe('printedBy', () => {
  const printed = (line: string) => printedBy(commandsOf(line))

  it('gives the JSON object of an argument, and the text of any other print', () => {
    expect(printed(`echo '{"a": 1}'`)).toEqual([{ json: { a: 1 }, text: '{"a": 1}' }])
    expect(printed('echo -n a b')).toEqual([{ json: undefined, text: 'a b' }])
    expect(printed(`printf '%s' '{"a":1}'`)).toEqual([{ json: { a: 1 }, text: '{"a":1}' }])
  })

  it('gives one item for each object, and nothing for a command that is not a printer', () => {
    expect(printed(`echo '{"a":1}' '{"b":2}'; ls`).map(({ json }) => json)).toEqual([
      { a: 1 },
      { b: 2 },
    ])
    expect(printed('ls; cat a')).toEqual([])
  })

  it('gives nothing for a print to stderr or a file, and drops the redirect from the text', () => {
    expect(printed('echo a >&2')).toEqual([])
    expect(printed('echo a > f')).toEqual([])
    expect(printed('echo a 2> f')).toEqual([{ json: undefined, text: 'a' }])
    expect(printed('echo a 2>/dev/null')).toEqual([{ json: undefined, text: 'a' }])
    expect(printed('echo a 2>/dev/null b')).toEqual([{ json: undefined, text: 'a b' }])
  })

  it('does not take text that fails to parse, or that is not an object, for JSON', () => {
    expect(printed(`echo '{x'`)).toEqual([{ json: undefined, text: '{x' }])
    expect(printed(`echo '[1]'`)).toEqual([{ json: undefined, text: '[1]' }])
  })

  it('tells a printer by the command word', () => {
    expect(isPrinter(['A=1', 'echo', 'a'])).toBe(true)
    expect(isPrinter(['/bin/echo'])).toBe(true)
    expect(isPrinter(['cat'])).toBe(false)
    expect(isPrinter([])).toBe(false)
  })
})
