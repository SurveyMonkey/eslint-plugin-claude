// The words of a shell line, as the hooks rules read them. The tests of `hooks-command-removed-cli-flag`
// also reach this module.
import { describe, expect, it } from 'vitest'
import {
  commandsOf,
  commandWordAt,
  isAssignment,
  isPrinter,
  printedBy,
  scanCommands,
  sinkOf,
  statementAt,
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
  const sink = (line: string, index = 0) => sinkOf(scanCommands(line), index)

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

  it('gives other for a command that a pipe or a command substitution takes', () => {
    expect(sink('echo a | cat')).toBe('other')
    expect(sink('x=$(echo a)', 1)).toBe('other')
    expect(sink('echo a | cat', 1)).toBe('stdout')
  })

  it('gives other for a redirect of both streams with &>, which the scanner splits at the &', () => {
    for (const line of ['echo a &>/dev/null', 'echo a &>> f', 'echo a &> f']) {
      expect(sink(line), line).toBe('other')
    }
  })

  it('reads the command at the index', () => {
    expect(sink('echo a >&2; echo b', 2)).toBe('stdout')
    expect(sink('echo a; echo b >&2', 1)).toBe('stderr')
  })
})

describe('printedBy', () => {
  const printed = (line: string) => printedBy(scanCommands(line))

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

  it('reads a printer after a word that starts a branch of a block', () => {
    for (const line of [
      `if x; then echo '{"a":1}'; fi`,
      `if x; then :; else echo '{"a":1}'; fi`,
      `for i in 1; do echo '{"a":1}'; done`,
      `x || { echo '{"a":1}'; }`,
      `! echo '{"a":1}'`,
    ]) {
      expect(
        printed(line).map(({ json }) => json),
        line,
      ).toEqual([{ a: 1 }])
    }
  })

  it('drops a \\n at the end of the format of printf, and not of echo', () => {
    expect(printed(`printf '{"a":1}\\n'`).map(({ json }) => json)).toEqual([{ a: 1 }])
    expect(printed(`printf '{"a":1}\\n\\n'`).map(({ json }) => json)).toEqual([{ a: 1 }])
    expect(printed(`echo '{"a":1}\\n'`).map(({ json }) => json)).toEqual([undefined])
  })

  it('reads the JSON of a printf format in double quotes, and a \\n at its end', () => {
    expect(printed('printf "{\\"a\\":1}\\n"').map(({ json }) => json)).toEqual([{ a: 1 }])
  })

  it('keeps a printer that a later redirect-only command does not take', () => {
    for (const line of [`echo '{"a":1}' && >f`, `echo '{"a":1}'; >f`, `echo '{"a":1}'\n>f`]) {
      expect(
        printed(line).map(({ json }) => json),
        line,
      ).toEqual([{ a: 1 }])
    }
    expect(printed(`echo '{"a":1}' &>f`)).toEqual([])
  })

  it('takes the text of a printer after a word that starts a branch', () => {
    expect(printed('if x; then echo a; fi')).toEqual([{ json: undefined, text: 'a' }])
  })

  it('tells a printer by the command word', () => {
    expect(isPrinter(['A=1', 'echo', 'a'])).toBe(true)
    expect(isPrinter(['/bin/echo'])).toBe(true)
    expect(isPrinter(['cat'])).toBe(false)
    expect(isPrinter([])).toBe(false)
  })
})

describe('statementAt', () => {
  it('skips assignments, wrappers and the words that start a branch of a block', () => {
    expect(statementAt(['exit', '2'])).toBe(0)
    expect(statementAt(['then', 'exit', '2'])).toBe(1)
    expect(statementAt(['{', 'A=1', 'exec', 'exit'])).toBe(3)
    expect(statementAt(['else', '!', 'echo'])).toBe(2)
    expect(statementAt([])).toBe(0)
    expect(statementAt(['then'])).toBe(1)
  })
})

describe('scanCommands', () => {
  const streams = (line: string) =>
    scanCommands(line).map(({ words, stdout }) => `${words.join(' ')}:${stdout ? 'out' : 'taken'}`)

  it('marks a command that a lone & ended the command before', () => {
    const ampAfter = (line: string) => scanCommands(line).map(({ afterAmp }) => afterAmp === true)
    expect(ampAfter('a & b')).toEqual([false, true])
    expect(ampAfter('a &b; c')).toEqual([false, true, false])
    expect(ampAfter('a && b')).toEqual([false, false])
    expect(ampAfter('a; >f')).toEqual([false, false])
  })

  it('keeps the backslash in double quotes, but before $, a backtick, a quote and a backslash', () => {
    expect(commandsOf('echo "a\\nb" "c\\$d" "e\\"f" "g\\\\h" i\\nj')).toEqual([
      ['echo', 'a\\nb', 'c$d', 'e"f', 'g\\h', 'inj'],
    ])
  })

  it('skips a comment to the end of its line, whatever quote it holds', () => {
    expect(commandsOf("echo a # it's here\nrm -rf x")).toEqual([
      ['echo', 'a'],
      ['rm', '-rf', 'x'],
    ])
    expect(commandsOf('echo a # say "hi\nrm x')).toEqual([
      ['echo', 'a'],
      ['rm', 'x'],
    ])
    expect(commandsOf('echo a # a `b\nrm x')).toEqual([
      ['echo', 'a'],
      ['rm', 'x'],
    ])
    expect(commandsOf('# only a comment')).toEqual([])
    expect(commandsOf('a;# c ; d\nb\r\nc')).toEqual([['a'], ['b'], ['c']])
    expect(commandsOf('a # b\\\nc')).toEqual([['a'], ['c']])
  })

  it('ends a comment in backticks at the closing backtick', () => {
    // Bash reads the body of a backtick pair first, so a comment in it ends there.
    expect(commandsOf('echo `echo a # b`; rm -rf x')).toEqual([
      ['echo'],
      ['echo', 'a'],
      ['rm', '-rf', 'x'],
    ])
    expect(commandsOf("echo `# it's`; rm y")).toEqual([['echo'], ['rm', 'y']])
  })

  it('skips a comment in a command substitution in double quotes', () => {
    expect(commandsOf(`echo "$(echo a # it's\n)"; rm z`)).toEqual([
      ['echo', `$(echo a # it's\n)`],
      ['rm', 'z'],
    ])
    expect(commandsOf('echo "$(echo a # )\n)"\nrm w')).toEqual([
      ['echo', '$(echo a # )\n)'],
      ['rm', 'w'],
    ])
    expect(commandsOf('echo "$(a$#)" "$(a #b')).toEqual([['echo', '$(a$#)', '$(a #b']])
    expect(commandsOf(`echo "$(# it's\n)" "$(a;# '\n)" "$(b|# '\n)" "$(c&# '\n)"; rm z`)).toEqual([
      ['echo', `$(# it's\n)`, `$(a;# '\n)`, `$(b|# '\n)`, `$(c&# '\n)`],
      ['rm', 'z'],
    ])
  })

  it('reads a # right after a substitution as part of the word', () => {
    expect(commandsOf('echo $(date)#x; rm -rf y')).toEqual([
      ['echo', '$'],
      ['date'],
      ['#x'],
      ['rm', '-rf', 'y'],
    ])
    expect(commandsOf('echo `date`#x; rm -rf y')).toEqual([
      ['echo'],
      ['date'],
      ['#x'],
      ['rm', '-rf', 'y'],
    ])
    expect(commandsOf('echo "$(echo $(date)#x)"; rm -rf y')).toEqual([
      ['echo', '$(echo $(date)#x)'],
      ['rm', '-rf', 'y'],
    ])
    // A `)` that closes a subshell ends a word, so a `#` after it starts a comment.
    expect(commandsOf('(a)#b\nc')).toEqual([['a'], ['c']])
    expect(commandsOf('echo $(date) #x; rm -rf y\nc')).toEqual([['echo', '$'], ['date'], ['c']])
  })

  it('reads a # as a comment only where a word starts, and outside quotes', () => {
    expect(commandsOf('echo a#b "# c" \'# d\' \\# e ""#f')).toEqual([
      ['echo', 'a#b', '# c', '# d', '#', 'e', '#f'],
    ])
    expect(commandsOf(`echo $# \${#x} "\${#y}" $(echo #z\nb)`)).toEqual([
      ['echo', '$#', `\${#x}`, `\${#y}`, '$'],
      ['echo'],
      ['b'],
    ])
  })

  it(`reads no comment in a \${...} expansion`, () => {
    // In a command substitution in double quotes.
    expect(commandsOf(`x="$(echo \${1% #*})" && rm -rf $TARGET`)).toEqual([
      [`x=$(echo \${1% #*})`],
      ['rm', '-rf', '$TARGET'],
    ])
    // Out of quotes, the expansion is one word, with its spaces and operators.
    expect(commandsOf(`echo \${1% #*}; rm -rf $T`)).toEqual([
      ['echo', `\${1% #*}`],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf(`echo \${@:-\${@} #*} \${x:-a;b|c&d}; rm -rf $T`)).toEqual([
      ['echo', `\${@:-\${@} #*}`, `\${x:-a;b|c&d}`],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf(`echo \${x/>#/y}; rm -rf $T`)).toEqual([
      ['echo', `\${x/>#/y}`],
      ['rm', '-rf', '$T'],
    ])
    // A tab in the expansion is plain text, as a space is.
    expect(commandsOf(`echo \${x:-a\tb}; rm -rf $T`)).toEqual([
      ['echo', `\${x:-a\tb}`],
      ['rm', '-rf', '$T'],
    ])
  })

  it(`reads the commands of a substitution in a \${...} expansion`, () => {
    expect(commandsOf(`echo \${x:-$(rm -rf $T)} a`)).toEqual([
      ['echo', `\${x:-$`],
      ['rm', '-rf', '$T'],
      ['}', 'a'],
    ])
    expect(commandsOf(`echo \${x:-\`rm -rf $T\`} a`)).toEqual([
      ['echo', `\${x:-`],
      ['rm', '-rf', '$T'],
      ['}', 'a'],
    ])
    // The `)` of a `case` pattern does not end the substitution. bash runs `rm`.
    expect(commandsOf(`echo \${x:-$(case a in a) rm -rf $T;; esac)}`)).toEqual([
      ['echo', `\${x:-$`],
      ['case', 'a', 'in', 'a'],
      ['rm', '-rf', '$T'],
      ['esac'],
      ['}'],
    ])
    expect(commandsOf(`echo \${x:-\`case a in a) rm -rf $T;; esac\`}`)).toEqual([
      ['echo', `\${x:-`],
      ['case', 'a', 'in', 'a'],
      ['rm', '-rf', '$T'],
      ['esac'],
      ['}'],
    ])
    // A `)` with no `(` before it leaves no expansion open.
    expect(commandsOf(`a) \${x} #y; b`)).toEqual([['a'], [`\${x}`]])
  })

  it(`reads a parenthesis in a \${...} expansion as plain text`, () => {
    // bash prints `a(b` and `a)b`, then runs the next command.
    expect(commandsOf(`echo \${x:-a(b} \${x:-a)b}; rm -rf $T`)).toEqual([
      ['echo', `\${x:-a(b}`, `\${x:-a)b}`],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf(`: $(echo \${x//(/_}); rm -rf $T`)).toEqual([
      [':', '$'],
      ['echo', `\${x//(/_}`],
      ['rm', '-rf', '$T'],
    ])
  })

  it('opens no expansion at a { after $$', () => {
    // bash prints the process id and `{a`, then runs the next command.
    expect(commandsOf('echo $${a; rm -rf $T')).toEqual([
      ['echo', '$${a'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf(`echo "$(echo $\${a # ')\n)"; rm -rf $T`)).toEqual([
      ['echo', `$(echo $\${a # ')\n)`],
      ['rm', '-rf', '$T'],
    ])
  })

  it('reads the commands of a bash 5.3 substitution in braces', () => {
    // bash 5.3 runs the commands after `${` and a blank or a `|`.
    expect(commandsOf(`echo \${ rm -rf $T; }`)).toEqual([['echo', '${', 'rm', '-rf', '$T'], ['}']])
    expect(commandsOf(`echo \${| rm -rf $T; }`)).toEqual([
      ['echo', '${'],
      ['rm', '-rf', '$T'],
      ['}'],
    ])
    expect(commandsOf(`echo \${\nrm -rf $T\n}`)).toEqual([
      ['echo', '${'],
      ['rm', '-rf', '$T'],
      ['}'],
    ])
    // A `#` after a blank in it starts a comment.
    for (const blank of [' ', '\n', '\t']) {
      expect(commandsOf(`x="$(echo \${${blank}a # it's\n})"; rm -rf $T`)).toEqual([
        [`x=$(echo \${${blank}a # it's\n})`],
        ['rm', '-rf', '$T'],
      ])
    }
  })

  it(`ends a \${...} expansion at a new line`, () => {
    // bash reads the body of a quoted here-document as text, then runs `rm`.
    expect(commandsOf("cat <<'E'\n${x\nE\nrm -rf $T")).toEqual([
      ['cat', '<<E'],
      ['${x'],
      ['E'],
      ['rm', '-rf', '$T'],
    ])
  })

  it(`reads no comment in a nested \${...} expansion in a substitution`, () => {
    expect(commandsOf(`x="$(echo \${@:-\${@} #*})" && rm -rf $T`)).toEqual([
      [`x=$(echo \${@:-\${@} #*})`],
      ['rm', '-rf', '$T'],
    ])
  })

  it('reads no comment after an escaped character', () => {
    expect(commandsOf('echo "$(echo a\\ #b)"; rm -rf $T')).toEqual([
      ['echo', '$(echo a\\ #b)'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo a\\ #b; rm -rf $T')).toEqual([
      ['echo', 'a #b'],
      ['rm', '-rf', '$T'],
    ])
    // After a blank too. bash opens a quote at the `'`, which takes the rest of the line.
    expect(commandsOf('echo "$(echo a \\ #b \')\n)"; rm -rf $T')).toEqual([
      ['echo', '$(echo a \\ #b \')\n)"; rm -rf $T'],
    ])
  })

  it('joins a # after line continuations to the word before them', () => {
    expect(commandsOf('echo "$(echo a\\\n#b)"; rm -rf $T')).toEqual([
      ['echo', '$(echo a\\\n#b)'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo "$(echo a\\\n\\\n#b)"; rm -rf $T')).toEqual([
      ['echo', '$(echo a\\\n\\\n#b)'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo a\\\n\\\n#b; rm -rf $T')).toEqual([
      ['echo', 'a#b'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo $(date)\\\n#x; rm -rf y')).toEqual([
      ['echo', '$'],
      ['date'],
      ['#x'],
      ['rm', '-rf', 'y'],
    ])
  })

  it('reads a comment after line continuations that follow white space or a new line', () => {
    expect(commandsOf('echo "$(echo a \\\n\\\n#b \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$(echo a \\\n\\\n#b ')\n)"],
      ['rm', '-rf', '$T'],
    ])
    // An escaped backslash before a new line is no continuation, so the `#` starts a word.
    expect(commandsOf('echo "$(echo a\\\\\n\\\n#b \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$(echo a\\\\\n\\\n#b ')\n)"],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo a \\\n\\\n#b; rm -rf $T\nc')).toEqual([['echo', 'a'], ['c']])
    // A backslash at the end of a comment joins no lines, so the next `#` follows a new line.
    expect(commandsOf('echo "$(a #c\\\n\\\n#d \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$(a #c\\\n\\\n#d ')\n)"],
      ['rm', '-rf', '$T'],
    ])
  })

  it('joins a # after an escaped character and line continuations to the word', () => {
    // bash prints `a #b`, `a;#b` or `a>#b`: the escaped character stays in the word.
    for (const escaped of [' ', ';', '>']) {
      expect(commandsOf(`echo "$(echo a\\${escaped}\\\n#b)"\nrm -rf $T`)).toEqual([
        ['echo', `$(echo a\\${escaped}\\\n#b)`],
        ['rm', '-rf', '$T'],
      ])
    }
  })

  it('reads a comment after an earlier escaped character in the substitution', () => {
    expect(commandsOf('echo "$(echo \\a # \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$(echo \\a # ')\n)"],
      ['rm', '-rf', '$T'],
    ])
  })

  it('reads a comment after a backtick that starts a substitution', () => {
    expect(commandsOf('echo "$(echo `#b \'`)"; rm -rf $T')).toEqual([
      ['echo', "$(echo `#b '`)"],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf("echo `#b '`; rm -rf $T")).toEqual([['echo'], ['rm', '-rf', '$T']])
  })

  it('reads a comment after a group in braces in a substitution', () => {
    expect(commandsOf('echo "$({ a; } # \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$({ a; } # ')\n)"],
      ['rm', '-rf', '$T'],
    ])
  })

  it('reads a comment after a redirect operator', () => {
    // bash reads `#x; rm -rf $T` as a comment, and refuses the redirect with no target.
    expect(commandsOf('echo hi >#x; rm -rf $T')).toEqual([['echo', 'hi', '>']])
    expect(commandsOf('cat <#x; rm -rf $T')).toEqual([['cat', '<']])
    expect(commandsOf('echo hi >\\\n#x; rm -rf $T')).toEqual([['echo', 'hi', '>']])
    for (const op of ['>', '<']) {
      expect(commandsOf(`echo "$(echo ${op}#x ')\n)"; rm -rf $T`)).toEqual([
        ['echo', `$(echo ${op}#x ')\n)`],
        ['rm', '-rf', '$T'],
      ])
    }
    expect(commandsOf('echo "$(echo >\\\n#x \')\n)"; rm -rf $T')).toEqual([
      ['echo', "$(echo >\\\n#x ')\n)"],
      ['rm', '-rf', '$T'],
    ])
  })

  it('keeps a # after an escaped or a quoted redirect operator in the word', () => {
    expect(commandsOf('echo \\>#x ">"#y; rm -rf $T')).toEqual([
      ['echo', '>#x', '>#y'],
      ['rm', '-rf', '$T'],
    ])
    expect(commandsOf('echo "$(echo \\>#x)"; rm -rf $T')).toEqual([
      ['echo', '$(echo \\>#x)'],
      ['rm', '-rf', '$T'],
    ])
    // A quote or a backslash after the redirect operator starts its target.
    expect(commandsOf('echo >"a"#b >\\a#c; rm -rf $T')).toEqual([
      ['echo', '>a#b', '>a#c'],
      ['rm', '-rf', '$T'],
    ])
  })

  it('stops at a depth, and does not throw or hang on a line of unclosed groups', () => {
    const start = Date.now()
    expect(scanCommands(`echo ${'"$('.repeat(20_000)}`)).toHaveLength(1)
    expect(scanCommands('a('.repeat(100_000))).toHaveLength(100_000)
    expect(Date.now() - start).toBeLessThan(5000)
  })

  it('marks a command that a pipe takes, and not a list operator', () => {
    expect(streams('a | b')).toEqual(['a:taken', 'b:out'])
    expect(streams('a |& b')).toEqual(['a:taken', 'b:out'])
    expect(streams('a || b && c; d & e')).toEqual(['a:out', 'b:out', 'c:out', 'd:out', 'e:out'])
  })

  it('marks a command in a command substitution or a backtick pair, at any depth', () => {
    expect(streams('x=$(a b) c')).toEqual(['x=$:out', 'a b:taken', 'c:out'])
    expect(streams('echo `a b` c')).toEqual(['echo:out', 'a b:taken', 'c:out'])
    expect(streams('$(a $(b) c) d')).toEqual(['$:out', 'a $:taken', 'b:taken', 'c:taken', 'd:out'])
  })

  it('does not mark a command in a group, and leaves the substitution level at the close', () => {
    expect(streams('(a; b) c')).toEqual(['a:out', 'b:out', 'c:out'])
    expect(streams('$(a) (b)')).toEqual(['$:out', 'a:taken', 'b:out'])
    expect(streams(')a')).toEqual(['a:out'])
  })

  it('keeps a command substitution in double quotes in the word, with the quotes of its own', () => {
    expect(scanCommands('echo "$(echo "it\'s")" x').map(({ words }) => words)).toEqual([
      ['echo', `$(echo "it's")`, 'x'],
    ])
    expect(commandsOf('echo "a $(f "b" \'c)\' d) e" f')).toEqual([
      ['echo', 'a $(f "b" \'c)\' d) e', 'f'],
    ])
    expect(commandsOf('echo "a `echo "b"` c" d')).toEqual([['echo', 'a `echo "b"` c', 'd']])
    expect(commandsOf('echo "$(a $(b ")") c)" d')).toEqual([['echo', '$(a $(b ")") c)', 'd']])
    expect(commandsOf('echo "$(echo \\) \\" x)" y')).toEqual([['echo', '$(echo \\) \\" x)', 'y']])
    expect(commandsOf('echo "a `echo \\` b` c" d')).toEqual([['echo', 'a `echo \\` b` c', 'd']])
  })

  it('reads a backslash, a substitution and a backtick pair inside a quote inside a substitution', () => {
    expect(commandsOf('echo "$(echo "a\\"b" c)" d')).toEqual([['echo', '$(echo "a\\"b" c)', 'd']])
    expect(commandsOf('echo "$(echo "x $(y ")") z")" d')).toEqual([
      ['echo', '$(echo "x $(y ")") z")', 'd'],
    ])
    expect(commandsOf('echo "$(echo "x `y ")` z")" d')).toEqual([
      ['echo', '$(echo "x `y ")` z")', 'd'],
    ])
  })

  it('reads to the end of the line for a substitution that does not close', () => {
    expect(commandsOf('echo "$(echo "a" b')).toEqual([['echo', '$(echo "a" b']])
    expect(commandsOf('echo "$(echo \'a b')).toEqual([['echo', "$(echo 'a b"]])
    expect(commandsOf('echo "$(echo `a b")')).toEqual([['echo', '$(echo `a b")']])
    expect(commandsOf('echo "$(echo "a b')).toEqual([['echo', '$(echo "a b']])
    expect(commandsOf('echo "a `b')).toEqual([['echo', 'a `b']])
    expect(commandsOf('echo "a $(b \\')).toEqual([['echo', 'a $(b \\']])
  })
})
