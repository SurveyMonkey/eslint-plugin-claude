// The shell splitter that `skill-inject-robustness` and `skill-side-effects-manual-only` share.
// The rule tests reach it through a rule. These cases call each export directly.
import { describe, expect, it } from 'vitest'
import { followsBang, READ_ONLY, subcommands, wordsOf } from '../src/shell-split.ts'

describe('subcommands', () => {
  it.each([
    ['a && b', ['a', 'b']],
    ['a || b', ['a', 'b']],
    ['a | b', ['a', 'b']],
    ['a |& b', ['a', 'b']],
    ['a ; b', ['a', 'b']],
    ['a & b', ['a', 'b']],
    ['a\nb', ['a', 'b']],
    ['a && b || c', ['a', 'b', 'c']],
  ])('splits %j at each separator', (text, expected) => {
    expect(subcommands(text)).toEqual(expected)
  })

  it('joins a line break after a backslash, in the LF and the CRLF form', () => {
    expect(subcommands('git \\\npush')).toEqual(['git  push'])
    expect(subcommands('git \\\r\npush')).toEqual(['git  push'])
  })

  it('does not split in a quoted string or a redirection', () => {
    expect(subcommands('echo "a && b" && ls')).toEqual(['echo "a && b"', 'ls'])
    expect(subcommands("echo 'a ; b' ; ls")).toEqual(["echo 'a ; b'", 'ls'])
    expect(subcommands('echo "a \\" && b" && ls')).toEqual(['echo "a \\" && b"', 'ls'])
    expect(subcommands('cmd 2>&1 | tail')).toEqual(['cmd 2>&1', 'tail'])
    expect(subcommands('cmd &> out && ls')).toEqual(['cmd &> out', 'ls'])
    expect(subcommands('cat <&3 | tail')).toEqual(['cat <&3', 'tail'])
    expect(subcommands('gh pr list --search "a && b" && npm test')).toEqual([
      'gh pr list --search "a && b"',
      'npm test',
    ])
  })

  it('drops a comment line, and keeps a comment at the end of a line', () => {
    expect(subcommands("# it's\ngit push")).toEqual(['git push'])
    expect(subcommands('a # b')).toEqual(['a # b'])
  })

  it('gives nothing for a text with no command', () => {
    expect(subcommands('')).toEqual([])
    expect(subcommands('\n\n')).toEqual([])
    expect(subcommands('if')).toEqual([])
    expect(subcommands(';;')).toEqual([])
  })

  it.each(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!'])(
    'drops the opening word %s',
    (word) => {
      expect(subcommands(`${word} npm test`)).toEqual(['npm test'])
    },
  )

  it('drops an opening bracket with no space, and several opening words', () => {
    expect(subcommands('(npm test')).toEqual(['npm test'])
    expect(subcommands('{npm test')).toEqual(['npm test'])
    expect(subcommands('if ! npm test')).toEqual(['npm test'])
    expect(subcommands('then ( npm test')).toEqual(['npm test'])
  })

  it('keeps a word that only starts like an opening word', () => {
    expect(subcommands('ifconfig')).toEqual(['ifconfig'])
    expect(subcommands('donext x')).toEqual(['donext x'])
    expect(subcommands('do-release x')).toEqual(['do-release x'])
    expect(subcommands('then-x')).toEqual(['then-x'])
    expect(subcommands('if-needed run')).toEqual(['if-needed run'])
  })

  it('drops the head of a case, and the pattern of each arm', () => {
    expect(subcommands('case $x in a) gh pr ;; esac')).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in --help) gh pr ;; esac')).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in "a") gh pr ;; esac')).toEqual(['gh pr', 'esac'])
    expect(subcommands("case $x in 'a') gh pr ;; esac")).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in a.b) gh pr ;; esac')).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in\na|b|c) gh pr ;;\nesac')).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in\n"a"|\'b\') gh pr ;;\nesac')).toEqual(['gh pr', 'esac'])
    expect(subcommands('case $x in a) echo in b ;; esac')).toEqual(['echo in b', 'esac'])
  })

  it('reads a case pattern only in a text with case', () => {
    expect(subcommands('(make)')).toEqual(['make'])
    expect(subcommands('a) b')).toEqual(['a) b'])
    expect(subcommands('a|b) x')).toEqual(['a', 'b) x'])
    expect(subcommands('showcase x\nfoo) y')).toEqual(['showcase x', 'foo) y'])
  })

  it('drops a closing bracket that closes a group the part did not open', () => {
    expect(subcommands('(gh pr)')).toEqual(['gh pr'])
    expect(subcommands('( gh pr )')).toEqual(['gh pr'])
    expect(subcommands('((gh pr))')).toEqual(['gh pr'])
    expect(subcommands('gh pr (x)')).toEqual(['gh pr (x)'])
  })
})

describe('wordsOf', () => {
  it('splits at white space and strips one quote at each end of a word', () => {
    expect(wordsOf('"git" push')).toEqual(['git', 'push'])
    expect(wordsOf("'a' 'b'")).toEqual(['a', 'b'])
    expect(wordsOf('a   b')).toEqual(['a', 'b'])
    expect(wordsOf('"a')).toEqual(['a'])
    expect(wordsOf('""a""')).toEqual(['"a"'])
  })
})

describe('followsBang', () => {
  it.each([
    ['!`x`', 1, true],
    ['a !`x`', 3, true],
    ['a\t!`x`', 3, true],
    ['a\n!`x`', 3, true],
  ])('is true for %j at %i', (text, start, expected) => {
    expect(followsBang(text, start)).toBe(expected)
  })

  it.each([
    ['`x`', 0],
    ['a`x`', 1],
    ['a!`x`', 2],
    ['!!`x`', 2],
    ['=!`x`', 2],
  ])('is false for %j at %i', (text, start) => {
    expect(followsBang(text, start)).toBe(false)
  })
})

describe('READ_ONLY', () => {
  it('holds the commands that run without a prompt', () => {
    expect([...READ_ONLY].sort()).toEqual(
      [
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
      ].sort(),
    )
  })
})
