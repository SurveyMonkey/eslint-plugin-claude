// The hooks reference lists the security practices for hooks: "Validate and sanitize inputs", and "Always quote
// shell variables: use "$VAR" not $VAR" (https://code.claude.com/docs/en/hooks#security-best-practices). It also
// warns that command hooks run with the full permissions of the user
// (https://code.claude.com/docs/en/hooks#disclaimer). The rule is a heuristic. The two patterns are the choice
// of the plugin: an unquoted variable in a shell command, and `rm` with a recursive flag on a variable that is
// unquoted or comes from the hook input. It reads the inline command and the repository scripts that the
// command runs.
import { chmodSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-command-shell-safety'
const P = `\${CLAUDE_PROJECT_DIR}`

/** The message ids for the handler fields `fields`, in a repository that holds `files`. */
function ids(fields: Record<string, unknown>, files: Record<string, string> = {}) {
  const text = settings(hooks('PostToolUse', [command(fields)], 'Write'))
  const root = repo({ ...files, '.claude/settings.json': text })
  return lintJson(name, text, path.join(root, '.claude/settings.json')).map(
    (message) => message.messageId,
  )
}
const line = (text: string) => ids({ command: text })
const script = (text: string, runner = `${P}/hooks/s.sh`) =>
  ids({ command: runner }, { 'hooks/s.sh': text })

describe(`${name}: an unquoted variable in the command`, () => {
  it('reports a variable outside quotes', () => {
    for (const text of [
      'cat $FILE',
      `cat \${FILE}`,
      'echo $1',
      `cat \${FILE:-x}`,
      'cat a$FILE',
      'x && cat $A',
    ]) {
      expect(line(text), text).toEqual(['unquoted'])
    }
  })

  it('reports once for a handler', () => {
    expect(line('cat $A $B; cat $C')).toEqual(['unquoted'])
  })

  it('names the variable in the message', () => {
    const text = settings(hooks('Stop', [command({ command: 'cat $FILE' })]))
    const [message] = lintJson(name, text, '/repo/.claude/settings.json')
    expect(message?.message).toBe(
      'The command uses $FILE with no quotes. The shell splits the value at spaces and expands globs. Write "$FILE" in double quotes.',
    )
  })

  it('is silent for a quoted variable', () => {
    for (const text of [
      'cat "$FILE"',
      `cat "\${FILE}"`,
      'cat "a $FILE b"',
      "cat '$FILE'",
      'cat \\$FILE',
      'cat "a\\"$FILE"',
    ]) {
      expect(line(text), text).toEqual([])
    }
  })

  it('is silent for an assignment, a test, a substitution, a special parameter and a comment', () => {
    for (const text of [
      'A=$B cmd',
      'A+=$B cmd',
      '[[ $X == y ]] && echo ok',
      'echo $(date)',
      'echo $((1 + 2))',
      'echo $? $$ $# $!',
      'echo ok # $FILE',
      'echo $',
      'ls',
      '',
    ]) {
      expect(line(text), text).toEqual([])
    }
  })

  it('reports a hash inside a word, which starts no comment', () => {
    expect(line('echo a#$FILE')).toEqual(['unquoted'])
  })

  it('reports $@ and $*, which split like any variable', () => {
    expect(line('cat $@')).toEqual(['unquoted'])
    expect(line('cat $*')).toEqual(['unquoted'])
  })

  it('is silent for a quoted variable inside a quoted command substitution', () => {
    for (const text of [
      'cd "$(dirname "$0")"',
      'echo "$(basename "$FILE")"',
      'source "$(dirname "$0")/lib.sh"',
      'X="$(echo "$INPUT" | jq -r .a)"',
    ]) {
      expect(line(text), text).toEqual([])
    }
  })

  it('reads the line after -c with the quotes of a substitution in it', () => {
    // H9 keeps the quotes of a quoted substitution in its word. Before, the `-c` line lost them and reported `$Y`.
    expect(line('bash -c "x=$(echo "$Y")"')).toEqual([])
    expect(line('bash -c "x=$(echo $Y)"')).toEqual(['unquoted'])
  })

  it('reads the inside of a command substitution on its own', () => {
    for (const text of ['echo $(ls $DIR)', 'echo "$(echo $X)"', 'echo $(cat $F']) {
      expect(line(text), text).toEqual(['unquoted'])
    }
  })

  it('finds the end of a command substitution past a quote, a parenthesis and a nested substitution', () => {
    for (const text of [
      'echo $(date) $FILE',
      'echo $(a $(b) c) $X',
      "echo $(echo ')') $Y",
      'echo "$(echo ")")" $x',
      'echo "$(sed \'s/(//\')" $y',
      'echo $(echo \\)) $Z',
      'echo $(echo "a\\"b $(date)") $U',
      'echo "a\\"b$(date)" $W',
      "echo $(echo 'a(' ) $V",
    ]) {
      expect(line(text), text).toEqual(['unquoted'])
    }
    expect(line("echo '$(ls $X)'")).toEqual([])
    expect(line('echo $(echo ")" ')).toEqual([])
    expect(line("echo $(echo '")).toEqual([])
    expect(line("echo \"$(printf ')'); echo '$HOME'\"")).toEqual([])
  })

  it('starts a new word after each comment line', () => {
    expect(script("#!/bin/bash\n# it's a hook\ncat $TARGET\n")).toEqual(['unquoted'])
    expect(script('#!/bin/bash\n# a hook\nrm -rf $TARGET\n')).toEqual(['destructive'])
    expect(script('#!/bin/bash\n# uses $FILE\ncat x\n')).toEqual([])
    expect(script('# c\nX=$Y\n')).toEqual([])
    expect(script('# c\n# $X\n')).toEqual([])
  })

  it('skips a quote in a comment inside a command substitution', () => {
    // A quote in a comment does not hide the end of the substitution, or the report below it.
    expect(script("x=$(date # it's\n)\ncat $FILE\n")).toEqual(['unquoted'])
    expect(script('x=$(date # a "quote\n)\ncat $FILE\n')).toEqual(['unquoted'])
    // In double quotes, a substitution that does not end hides the report below it.
    for (const text of [
      "date # it's\n",
      "date;# it's\n",
      "date|# it's\n cat",
      "date&# it's\n",
      "date\t# it's\n",
      "# it's\n",
      "echo (# it's\n)",
      // A comment after an expansion that ends, and after a group in braces.
      `echo \${@} # it's\n`,
      "{ date; } # it's\n",
    ]) {
      expect(script(`x="$(${text})"\nrm -rf $TARGET\n`), text).toEqual(['destructive'])
    }
  })

  it('skips a quote in a comment in an array', () => {
    expect(script("x=(a # it's\nb)\ncat $FILE\n")).toEqual(['unquoted'])
  })

  it('ends a comment in a command substitution at the end of its line', () => {
    expect(script('x=$(date # it\'s\n)\ncat "$FILE"\n')).toEqual([])
    expect(script("x=$(date # it's")).toEqual([])
  })

  it('keeps a hash after a closing parenthesis or backtick in the word', () => {
    // The `#` is part of the word, so the quote after it opens a quote that hides the `)`.
    expect(script('x="$(echo $(a)#it\'s\n)"\nrm -rf $TARGET\n')).toEqual([])
    expect(script('x="$(echo `a`#it\'s\n)"\nrm -rf $TARGET\n')).toEqual([])
  })

  it('reads no comment where a # does not start a word', () => {
    // A `#` in a parameter expansion, or after an escaped space, is not a comment. The
    // expansions name no variable, so the report comes from the variable after the quote.
    for (const text of [
      `echo \${@% #*}`,
      `echo \${@// #/}`,
      `echo \${@:-\${@% #*}}`,
      // The inner expansion ends, and the `#` is still in the outer one.
      `echo \${@:-\${@} #*}`,
      'ls a\\ #b',
      'ls a \\ #b',
      // The shell removes the backslash and the new line, so the `#` is in the word `a#b`.
      'ls a\\\n#b',
    ]) {
      expect(line(`x="$(${text})" && cat $FILE`), text).toEqual(['unquoted'])
    }
  })

  it('reads a comment after a line continuation, or after a backtick that starts a substitution', () => {
    // The shell removes the backslash and the new line, so the `#` starts a word.
    expect(script('x="$(date \\\n# it\'s\n)"\nrm -rf $TARGET\n')).toEqual(['destructive'])
    expect(script('x="$(echo `#it\'s`)"\nrm -rf $TARGET\n')).toEqual(['destructive'])
    expect(script('x="$(echo `\\\n#it\'s`)"\nrm -rf $TARGET\n')).toEqual(['destructive'])
    // A quote at the end of the comment is plain text too.
    expect(script('x="$(date # it\'\n)"\nrm -rf $TARGET\n')).toEqual(['destructive'])
  })

  it('joins a # after line continuations to the word before them', () => {
    // The shell removes each backslash and new line pair first, so the `#` is in the word `a#b`.
    // The quote after it then opens a quote that hides the `)` and the variable.
    expect(line('x="$(echo a\\\n\\\n#b \')\n)" && cat $FILE')).toEqual([])
    expect(line('x="$(echo a\\\n\\\n\\\n#b \')\n)" && cat $FILE')).toEqual([])
    // An escaped space or redirect operator before the pairs stays in the word too.
    expect(line('x="$(echo a\\ \\\n#b \')\n)" && cat $FILE')).toEqual([])
    expect(line('x="$(echo a\\>\\\n#b \')\n)" && cat $FILE')).toEqual([])
  })

  it('reads a comment after line continuations that follow white space or a new line', () => {
    expect(line('x="$(echo a \\\n\\\n#b \')\n)" && cat $FILE')).toEqual(['unquoted'])
    // An escaped backslash before a new line is no continuation, so the `#` starts a word.
    expect(line('x="$(echo a\\\\\n\\\n#b \')\n)" && cat $FILE')).toEqual(['unquoted'])
    // A backslash at the end of a comment joins no lines, so the next `#` follows a new line.
    expect(line('x="$(echo a #c\\\n\\\n#d \')\n)" && cat $FILE')).toEqual(['unquoted'])
  })

  it('opens no expansion at a { after $$', () => {
    // bash reads `$$` as the process id, so the `#` starts a comment.
    expect(line(`x="$(echo $\${a # ')\n)" && cat $FILE`)).toEqual(['unquoted'])
  })

  it('reads a bash 5.3 substitution in braces as commands', () => {
    // A `#` after a blank in it starts a comment, so the `)` on the next line ends the outer one.
    expect(line(`echo "$(echo \${ a # it')\n})" $F`)).toEqual(['unquoted'])
    expect(line(`F=$(jq -r .x); echo \${| rm -rf $F; }`)).toEqual(['destructive'])
  })

  it('reads the commands after a case pattern in a substitution in an expansion', () => {
    expect(line(`D=$(jq -r .x); echo \${y:-$(case $z in a) rm -rf $D;; esac)}`)).toEqual([
      'destructive',
    ])
  })

  it('reads a comment after a redirect, as after a space', () => {
    // bash reads `#x ')` as a comment, so the `)` on the next line ends the substitution.
    for (const text of [
      'echo "$(echo >#x \')\n)" $F',
      'echo "$(cat <#x \')\n)" $F',
      'echo "$(echo >\\\n#x \')\n)" $F',
      'echo "$(echo > #x \')\n)" $F',
    ]) {
      expect(line(text), text).toEqual(['unquoted'])
    }
  })

  it('ends a comment in a backtick substitution at the backtick that ends it', () => {
    expect(line('x="$(echo `id -u # uid`)"; rm -rf $TARGET')).toEqual(['destructive'])
    // The second backtick ends the substitution, so a backtick in a later comment is plain text.
    expect(script('x="$(echo `id # u`; date # a ` it\'s\n)"\nrm -rf $TARGET\n')).toEqual([
      'destructive',
    ])
    // Out of a backtick substitution, a backtick in a comment is plain text.
    expect(script('x="$(date # a ` it\'s\n)"\nrm -rf $TARGET\n')).toEqual(['destructive'])
  })

  it('reads a test that ends, and the lines after it', () => {
    expect(line('[[ -n "$X" ]]\ncat $FILE')).toEqual(['unquoted'])
  })

  it('is silent for the path placeholders, which hooks-placeholder-quoted reads', () => {
    for (const text of [`${P}/a.sh`, '$CLAUDE_PROJECT_DIR/a.sh', `\${CLAUDE_PLUGIN_ROOT}/a.sh`]) {
      expect(line(text), text).toEqual([])
    }
  })

  it('is silent in exec form, and in shell form for PowerShell, which the scan does not read', () => {
    expect(ids({ command: 'cat', args: ['$FILE'] })).toEqual([])
    expect(ids({ command: 'cat $FILE', args: [] })).toEqual([])
    expect(ids({ command: 'cat $FILE', shell: 'powershell' })).toEqual([])
  })

  it('reads a script of an exec form handler, where shell is ignored', () => {
    expect(
      ids(
        { command: `${P}/hooks/s.sh`, args: [], shell: 'powershell' },
        { 'hooks/s.sh': 'cat $F\n' },
      ),
    ).toEqual(['unquoted'])
  })

  it('reads a shell line after -c again', () => {
    expect(line("bash -c 'cat $FILE'")).toEqual(['unquoted'])
    expect(line('bash -lc \'cat "$FILE"\'')).toEqual([])
    expect(line("bash -lc 'cat $FILE'")).toEqual(['unquoted'])
    expect(line("/bin/bash -c 'cat $FILE'")).toEqual(['unquoted'])
    expect(line('bash -c')).toEqual([])
    expect(line("python -c 'cat $FILE'")).toEqual([])
  })
})

describe(`${name}: rm on a variable`, () => {
  it('reports rm with a recursive flag on an unquoted variable', () => {
    for (const text of [
      'rm -rf $FILE',
      `rm -fr \${DIR}/x`,
      'rm -R $A',
      'rm --recursive $A',
      'rm -f -r $A',
      'sudo true; exec rm -r $A',
    ]) {
      expect(line(text), text).toEqual(['destructive'])
    }
  })

  it('names the variable in the message', () => {
    const text = settings(hooks('Stop', [command({ command: 'rm -rf $FILE' })]))
    const [message] = lintJson(name, text, '/repo/.claude/settings.json')
    expect(message?.message).toBe(
      'The command runs "rm" with a recursive flag on $FILE, a path that comes from a variable. Check the path before it, and quote the variable.',
    )
  })

  it('reports a quoted variable that holds hook input', () => {
    for (const text of [
      'FILE=$(jq -r .tool_input.file_path); rm -rf "$FILE"',
      'FILE=$(cat); rm -rf "$FILE"',
      'export FILE=$(echo "$INPUT" | jq -r .p)\nrm -rf "$FILE"',
      'read -r FILE; rm -rf "$FILE"',
      'local DIR=$(jq -r .d); rm -rf "$DIR"/x',
    ]) {
      expect(line(text), text).toEqual(['destructive'])
    }
  })

  it('is silent for rm on a quoted variable that holds no hook input', () => {
    for (const text of [
      'rm -rf "$TMP"',
      'FILE=$(date); rm -rf "$FILE"',
      'FILE=$(jq -r .a); rm -rf "$OTHER"',
      'read -r X; rm -rf "$FILE"',
    ]) {
      expect(line(text), text).toEqual([])
    }
  })

  it('is silent for rm with no recursive flag, rm on a literal path and another command', () => {
    for (const text of [
      'rm -f "$A"',
      'rm "$A"',
      'rm -rf build',
      'echo rm -rf "$A"',
      'rmdir "$A"',
      'rm -rf',
    ]) {
      expect(line(text), text).toEqual([])
    }
  })
})

describe(`${name}: a repository script`, () => {
  it('reports an unquoted variable in a script that the command runs', () => {
    expect(script('#!/bin/bash\ncat $FILE\n')).toEqual(['unquoted'])
    expect(script('cat $FILE\n')).toEqual(['unquoted'])
  })

  it('reports rm on a derived variable in a script', () => {
    expect(script('#!/bin/bash\nF=$(jq -r .p)\nrm -rf "$F"\n')).toEqual(['destructive'])
  })

  it('reads a script that bash, sh or zsh runs, and a script in exec form', () => {
    for (const runner of [
      `bash ${P}/hooks/s.sh`,
      `sh -e "${P}/hooks/s.sh"`,
      `zsh -o pipefail ${P}/hooks/s.sh`,
      `bash +x ${P}/hooks/s.sh`,
    ]) {
      expect(script('cat $FILE\n', runner), runner).toEqual(['unquoted'])
    }
    expect(
      ids({ command: `${P}/hooks/s.sh`, args: ['x'] }, { 'hooks/s.sh': 'cat $FILE\n' }),
    ).toEqual(['unquoted'])
    expect(
      ids({ command: 'bash', args: [`${P}/hooks/s.sh`] }, { 'hooks/s.sh': 'cat $FILE\n' }),
    ).toEqual(['unquoted'])
  })

  it('reads the script in the args of a shell, past an item that is no string', () => {
    expect(
      ids({ command: 'bash', args: [5, `${P}/hooks/s.sh`] }, { 'hooks/s.sh': 'cat $FILE\n' }),
    ).toEqual(['unquoted'])
  })

  it('finds no script in a shell with flags only', () => {
    expect(script('cat $FILE\n', 'bash -e')).toEqual([])
    expect(script('cat $FILE\n', 'bash -o')).toEqual([])
  })

  it('reports the command before the script when both have a fault, and once', () => {
    const text = settings(hooks('Stop', [command({ command: `cat $A; ${P}/hooks/s.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/s.sh': 'cat $FILE\n' })
    const found = lintJson(name, text, path.join(root, '.claude/settings.json'))
    expect(found.map((message) => message.message.slice(0, 22))).toEqual(['The command uses $A wi'])
  })

  it('reads the script of a shell given by path, and any shell shebang', () => {
    expect(script('cat $FILE\n', `/bin/bash ${P}/hooks/s.sh`)).toEqual(['unquoted'])
    expect(script('cat $FILE\n', `bash --rcfile x.rc ${P}/hooks/s.sh`)).toEqual(['unquoted'])
    expect(script('cat $FILE\n', `bash -O extglob ${P}/hooks/s.sh`)).toEqual(['unquoted'])
    for (const shebang of ['#!/usr/bin/env zsh', '#!/bin/dash', '#!/bin/ksh']) {
      expect(script(`${shebang}\ncat $FILE\n`), shebang).toEqual(['unquoted'])
    }
  })

  it('reads a path placeholder in a script as an ordinary variable', () => {
    expect(script('cat $CLAUDE_PROJECT_DIR/x\n')).toEqual(['unquoted'])
  })

  it('skips PowerShell only when shell is exactly powershell', () => {
    expect(ids({ command: 'cat $FILE', shell: 'bash' })).toEqual(['unquoted'])
  })

  it('names the script in the message', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/s.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/s.sh': 'cat $FILE\n' })
    const [message] = lintJson(name, text, path.join(root, '.claude/settings.json'))
    expect(message?.message).toBe(
      'The script "s.sh" uses $FILE with no quotes. The shell splits the value at spaces and expands globs. Write "$FILE" in double quotes.',
    )
  })

  it('is silent for a safe script', () => {
    expect(script('#!/bin/bash\ncat "$FILE"\n')).toEqual([])
  })

  it('is silent for a script of another language', () => {
    for (const text of [
      '#!/usr/bin/env python3\ncat $FILE\n',
      '#!/usr/bin/env node\ncat $FILE\n',
    ]) {
      expect(script(text), text).toEqual([])
    }
    expect(ids({ command: `${P}/hooks/s.py` }, { 'hooks/s.py': 'cat $FILE\n' })).toEqual([])
    expect(ids({ command: `${P}/hooks/s.JS` }, { 'hooks/s.JS': 'cat $FILE\n' })).toEqual([])
    expect(ids({ command: `${P}/hooks/s.ps1` }, { 'hooks/s.ps1': 'cat $FILE\n' })).toEqual([])
  })

  it('is silent for a script that another program runs, and a path that is not resolved', () => {
    expect(script('cat $FILE\n', `node ${P}/hooks/s.sh`)).toEqual([])
    expect(script('cat $FILE\n', './hooks/s.sh')).toEqual([])
    expect(script('cat $FILE\n', `bash -c ${P}/hooks/s.sh`)).toEqual([])
  })

  it('is silent for a missing script, a binary file, a link out of the repository and a dangling link', () => {
    expect(ids({ command: `${P}/hooks/none.sh` })).toEqual([])
    expect(script('cat $FILE\n\0')).toEqual([])
    const outside = repo({ 'x/s.sh': 'cat $FILE\n' })
    const text = settings(hooks('Stop', [command({ command: `${P}/a.sh; ${P}/b.sh` })]))
    const root = repo({ '.claude/settings.json': text })
    symlinkSync(path.join(outside, 'x/s.sh'), path.join(root, 'a.sh'))
    symlinkSync(path.join(root, 'gone.sh'), path.join(root, 'b.sh'))
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('is silent for a file that it cannot read', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/s.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/s.sh': 'cat $FILE\n' })
    const file = path.join(root, 'hooks/s.sh')
    withoutAccess(file, () => {
      expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
    })
    chmodSync(file, 0o644)
  })

  it('is silent in a hidden drop-in', () => {
    const text = settings(hooks('Stop', [command({ command: 'cat $FILE' })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
  })
})
