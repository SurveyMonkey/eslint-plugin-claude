// The words of a shell line, as the hooks rules read them. The tests of `hooks-command-removed-cli-flag`
// also reach this module.
import { describe, expect, it } from 'vitest'
import {
  commandsOf,
  commandWordAt,
  isAssignment,
  isClaude,
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

  it('reads past an absolute path to a wrapper, and keeps the plain words', () => {
    expect(commandWordAt(['/usr/bin/env', 'claude'])).toBe(1)
    expect(commandWordAt(['/bin/env', 'FOO=1', 'claude'])).toBe(2)
    expect(commandWordAt(['/usr/bin/nohup', '/usr/bin/command', 'claude'])).toBe(2)
    // Git for Windows installs `env.exe` and `nohup.exe` in `usr\bin`.
    expect(commandWordAt(['C:\\Program Files\\Git\\usr\\bin\\env.exe', 'claude'])).toBe(1)
    expect(commandWordAt(['c:/Program Files/Git/usr/bin/nohup.EXE', 'claude'])).toBe(1)
    // A UNC path starts with two backslashes. One backslash does not start a UNC path.
    expect(commandWordAt(['\\\\server\\tools\\env.exe', 'claude'])).toBe(1)
    expect(commandWordAt(['\\env', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/env'])).toBe(1)
    expect(commandWordAt(['env', 'claude'])).toBe(1)
  })

  it('does not read a path that is not a wrapper', () => {
    expect(commandWordAt(['/usr/bin/envx', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/xenv', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/env/', 'claude'])).toBe(0)
    expect(commandWordAt(['C:\\bin\\env\\', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/env.exe.sh', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/.exeenv', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/envxexe', 'claude'])).toBe(0)
    expect(commandWordAt(['/usr/bin/ENV', 'claude'])).toBe(0)
  })

  it('does not read a script of the hook that has the name of a wrapper, or a path to exec', () => {
    // bash runs the file of the hook, and never the wrapper. No `exec` program exists.
    for (const word of ['./exec', './scripts/env', 'scripts/nohup', '~/bin/env', '/bin/exec']) {
      expect(commandWordAt([word, 'claude']), word).toBe(0)
    }
    expect(commandWordAt(['$CLAUDE_PLUGIN_ROOT/hooks/env', 'claude'])).toBe(0)
    expect(commandWordAt(['$HOME/bin/command', 'claude'])).toBe(0)
    // A drive letter with no separator after it starts a relative path on Windows.
    expect(commandWordAt(['C:tools\\env', 'claude'])).toBe(0)
    // A relative path can hold a drive letter after its start.
    expect(commandWordAt(['./c:/env', 'claude'])).toBe(0)
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

describe('isClaude', () => {
  it('reads the last part of a path with slashes or backslashes', () => {
    expect(isClaude('claude')).toBe(true)
    expect(isClaude('/usr/local/bin/claude')).toBe(true)
    expect(isClaude('C:\\Tools\\claude.exe')).toBe(true)
    expect(isClaude('C:\\Tools\\claude')).toBe(true)
  })

  it('is false for a path that ends in a separator, which names a directory', () => {
    expect(isClaude('/usr/bin/claude/')).toBe(false)
    expect(isClaude('C:\\Tools\\claude\\')).toBe(false)
  })

  it('reads the name in lower case only, and the .exe in any case', () => {
    expect(isClaude('C:/Tools/claude.EXE')).toBe(true)
    expect(isClaude('C:/Tools/Claude.EXE')).toBe(false)
  })

  it('needs a literal dot before the exe', () => {
    expect(isClaude('claudeXexe')).toBe(false)
  })

  it('reads the part after the last separator when a path mixes `/` and `\\`', () => {
    expect(isClaude('C:/Tools\\claude.exe')).toBe(true)
    expect(isClaude('C:\\Tools/claude.exe')).toBe(true)
    expect(isClaude('C:/claude\\node.exe')).toBe(false)
    expect(isClaude('C:\\claude/node.exe')).toBe(false)
  })

  it('keeps `C:claude.exe` whole, because it has no separator', () => {
    // bash gives `C:claude.exe` for an unquoted `C:\claude.exe`.
    expect(isClaude('C:claude.exe')).toBe(false)
  })

  it('is false for a directory named claude in a path', () => {
    expect(isClaude('C:\\claude\\node.exe')).toBe(false)
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

  it(`ends a \${...} expansion at a new line when the next line has no }`, () => {
    // bash reads the body of a quoted here-document as text, then runs `rm`. The reader does not
    // know a here-document. Out of one, bash refuses a `${` with no `}`.
    expect(commandsOf("cat <<'E'\n${x\nE\nrm -rf $T")).toEqual([
      ['cat', '<<E'],
      ['${x'],
      ['E'],
      ['rm', '-rf', '$T'],
    ])
    // bash 5.3 prints `${x`, then runs `rm` and `echo`. A `}` two lines after the `${` does
    // not keep the new line in the expansion.
    expect(commandsOf(`cat <<'E'\n\${x\nE\nrm -rf $T; echo \${y}`)).toEqual([
      ['cat', '<<E'],
      [`\${x`],
      ['E'],
      ['rm', '-rf', '$T'],
      ['echo', `\${y}`],
    ])
    // A `}` before the `${` does not keep it either.
    expect(commandsOf(`echo \${y}; cat <<'E'\n\${x\nE\nrm -rf $T`)).toEqual([
      ['echo', `\${y}`],
      ['cat', '<<E'],
      [`\${x`],
      ['E'],
      ['rm', '-rf', '$T'],
    ])
  })

  it(`reads a parenthesis in a \${...} expansion in a substitution as plain text`, () => {
    // bash 5.3 prints `( #a)`, then `after`. The `#` is in the expansion.
    expect(commandsOf(`echo "$(echo \${x:-( #a)})"; echo after`)).toEqual([
      ['echo', `$(echo \${x:-( #a)})`],
      ['echo', 'after'],
    ])
    // A lone parenthesis in the expansion does not change the level. bash 5.3 prints `(` or
    // `)`, then `RAN`.
    expect(commandsOf(`echo "$(echo \${a:-(})"; echo RAN`)).toEqual([
      ['echo', `$(echo \${a:-(})`],
      ['echo', 'RAN'],
    ])
    expect(commandsOf(`echo "$(echo \${a:-(} #c"\n)"; echo RAN`)).toEqual([
      ['echo', `$(echo \${a:-(} #c"\n)`],
      ['echo', 'RAN'],
    ])
    expect(commandsOf(`echo "$(echo \${a:-)} #c"\n)"; echo RAN`)).toEqual([
      ['echo', `$(echo \${a:-)} #c"\n)`],
      ['echo', 'RAN'],
    ])
  })

  it(`reads a process substitution in a \${...} expansion as a new level`, () => {
    // bash 5.3 prints `/dev/fd/63`, then `RAN`. `#x ")` is a comment.
    for (const operator of ['<', '>']) {
      expect(commandsOf(`echo "$(echo \${a:-${operator}(true #x ")\n)})"; echo RAN`)).toEqual([
        ['echo', `$(echo \${a:-${operator}(true #x ")\n)})`],
        ['echo', 'RAN'],
      ])
    }
    // bash 5.3 prints `/dev/fd/63 #y`, then `RAN`. The `}` in the process substitution does not
    // end the expansion.
    expect(commandsOf(`echo \${a:-<(echo }) #y}; echo RAN`)).toEqual([
      ['echo', `\${a:-<`],
      ['echo', '}'],
      [' #y}'],
      ['echo', 'RAN'],
    ])
  })

  it(`reads no comment in a nested \${...} expansion in a substitution`, () => {
    expect(commandsOf(`x="$(echo \${@:-\${@} #*})" && rm -rf $T`)).toEqual([
      [`x=$(echo \${@:-\${@} #*})`],
      ['rm', '-rf', '$T'],
    ])
  })

  it(`keeps the \${...} count of each substitution level apart`, () => {
    // bash 5.3 prints `} #`, then `SECOND`. The `}` in the inner substitution does not end the
    // expansion, so the `#` stays in it.
    expect(streams(`echo "$(echo \${x:-$(echo }) #})"; echo SECOND`)).toEqual([
      `echo $(echo \${x:-$(echo }) #}):out`,
      'echo SECOND:out',
    ])
    expect(streams(`echo $(echo \${x:-$(echo }) #}); echo SECOND`)).toEqual([
      'echo $:out',
      `echo \${x:-$:taken`,
      'echo }:taken',
      ' #}:taken',
      'echo SECOND:out',
    ])
    // bash 5.3 prints `} #`, then `SECOND`. A `}` in backticks does not end the expansion.
    expect(commandsOf(`echo "$(echo \${@:-\`echo }\` #})"; echo SECOND`)).toEqual([
      ['echo', `$(echo \${@:-\`echo }\` #})`],
      ['echo', 'SECOND'],
    ])
    // bash 5.3 prints `y`, then `hi`. In the inner substitution, the `#` starts a comment.
    expect(commandsOf(`echo "$(echo \${a:-$(true #c ')\n)y})"; echo hi`)).toEqual([
      ['echo', `$(echo \${a:-$(true #c ')\n)y})`],
      ['echo', 'hi'],
    ])
    expect(commandsOf(`echo \${a:-$(true #c ')\n)y}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      ['y}'],
      ['echo', 'hi'],
    ])
    expect(commandsOf(`echo \${a:-\`true #c '\`y}; echo hi`)).toEqual([
      ['echo', `\${a:-`],
      ['true'],
      ['y}'],
      ['echo', 'hi'],
    ])
  })

  it(`goes on with a \${...} expansion after a substitution in it`, () => {
    // bash 5.3 prints `#y`, then `hi`.
    expect(streams(`echo \${a:-$(true) #y}; echo hi`)).toEqual([
      `echo \${a:-$:out`,
      'true:taken',
      ' #y}:out',
      'echo hi:out',
    ])
    expect(streams(`echo \${a:-\`true\` #y}; echo hi`)).toEqual([
      `echo \${a:-:out`,
      'true:taken',
      ' #y}:out',
      'echo hi:out',
    ])
    // In double quotes too. bash 5.3 prints `#y`, then `hi`.
    expect(commandsOf(`echo "$(echo \${a:-$(true) #y})"; echo hi`)).toEqual([
      ['echo', `$(echo \${a:-$(true) #y})`],
      ['echo', 'hi'],
    ])
    // bash 5.3 prints `;x`, then `hi`. The `;` is in the expansion.
    expect(commandsOf(`echo \${a:-$(true);x}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [';x}'],
      ['echo', 'hi'],
    ])
    // The same after a backtick substitution. bash 5.3 prints `;x`, then `hi`.
    expect(commandsOf(`echo \${a:-\`true\`;x}; echo hi`)).toEqual([
      ['echo', `\${a:-`],
      ['true'],
      [';x}'],
      ['echo', 'hi'],
    ])
  })

  it(`goes on with a \${...} expansion after two or more substitutions in it`, () => {
    // bash 5.3.9 prints `#y z`. The `#` starts no comment.
    expect(commandsOf(`echo \${a:-$(true) $(false) #y} z`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [' $'],
      ['false'],
      [' #y}', 'z'],
    ])
    // bash 5.3.9 prints `#y`, then `hi`.
    expect(commandsOf(`echo \${a:-$(true) $(false) $(true) #y}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [' $'],
      ['false'],
      [' $'],
      ['true'],
      [' #y}'],
      ['echo', 'hi'],
    ])
    // bash 5.3.9 prints `/dev/fd/63 #y`, then `hi`. A process substitution after the first
    // substitution keeps the expansion open too.
    expect(commandsOf(`echo \${a:-$(true) <(false) #y}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [' <'],
      ['false'],
      [' #y}'],
      ['echo', 'hi'],
    ])
    // bash 5.3.9 prints `) #y`, then `hi`. The `)` in the backtick pair does not end the level.
    expect(commandsOf(`echo \${a:-$(true) \`echo ")"\` #y}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [' '],
      ['echo', ')'],
      [' #y}'],
      ['echo', 'hi'],
    ])
  })

  it(`keeps the \${...} expansion open after a substitution and a backtick pair`, () => {
    // bash 5.3.9 prints `#y`, then `hi`.
    expect(commandsOf(`echo \${a:-$(true) \`false\` #y}; echo hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      [' '],
      ['false'],
      [' #y}'],
      ['echo', 'hi'],
    ])
    // In double quotes, `closingParen` reads the same. bash 5.3.9 sets `x='#y z'`, then runs `w`.
    expect(commandsOf(`x="$(echo \${a:-$(true) $(false) #y}) z" w`)).toEqual([
      [`x=$(echo \${a:-$(true) $(false) #y}) z`, 'w'],
    ])
  })

  it(`goes on with a \${...} expansion after a new line in it`, () => {
    // bash 5.3 prints `x #y`, then `hi`.
    expect(commandsOf(`echo \${a:-x\n #y}; echo hi`)).toEqual([
      ['echo', `\${a:-x\n #y}`],
      ['echo', 'hi'],
    ])
    expect(commandsOf(`echo "$(echo \${a:-x\n #y})"; echo hi`)).toEqual([
      ['echo', `$(echo \${a:-x\n #y})`],
      ['echo', 'hi'],
    ])
  })

  it(`reads a comment after a \${...} expansion or a substitution that ends`, () => {
    // bash 5.3 prints an empty line, then `hi`.
    expect(commandsOf(`echo \${x} #y\necho hi`)).toEqual([
      ['echo', `\${x}`],
      ['echo', 'hi'],
    ])
    expect(commandsOf('echo $(true) #y\necho hi')).toEqual([
      ['echo', '$'],
      ['true'],
      ['echo', 'hi'],
    ])
    expect(commandsOf(`echo \${a:-$(true)} #y\necho hi`)).toEqual([
      ['echo', `\${a:-$`],
      ['true'],
      ['}'],
      ['echo', 'hi'],
    ])
    // In double quotes too. bash 5.3 reads `#y ')` as a comment, so the `)` on the next line
    // ends the substitution. It prints an empty line, then `hi`.
    expect(commandsOf(`echo "$(echo \${a:-$(true)} #y ')\n)"; echo hi`)).toEqual([
      ['echo', `$(echo \${a:-$(true)} #y ')\n)`],
      ['echo', 'hi'],
    ])
  })

  it('goes on with a word after a process substitution', () => {
    // bash 5.3 gives `cat` the argument `/dev/fd/63#x`. The `#` starts no comment.
    expect(commandsOf('cat <(true)#x; echo hi')).toEqual([
      ['cat', '<'],
      ['true'],
      ['#x'],
      ['echo', 'hi'],
    ])
    expect(commandsOf('cat >(true)#x; echo hi')).toEqual([
      ['cat', '>'],
      ['true'],
      ['#x'],
      ['echo', 'hi'],
    ])
    // bash 5.3 runs `true`, reads `#x` as a comment, then prints `after`.
    expect(commandsOf('(true)#x\necho after')).toEqual([['true'], ['echo', 'after']])
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
