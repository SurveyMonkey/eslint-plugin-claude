// The expected values come from the statusline page
// (https://code.claude.com/docs/en/statusline#size-output-to-the-terminal): "Claude Code captures
// your script's output instead of connecting it directly to the terminal, so `tput cols` and
// language-level width detection cannot read the terminal size from inside the script. Read the
// `COLUMNS` and `LINES` environment variables instead." The rule reads the script from the
// repository, so each case builds a tree on disk. The script path follows `statusline-script-exists`:
// the program, or the first argument of an interpreter, with a path from the project or with
// `${CLAUDE_PROJECT_DIR}`. The file globs are in `tests/configs.test.ts`.
import { chmodSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'statusline-script-terminal-size'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
const DROP_IN = 'managed-settings.d/20-b.json'
const TPUT = '#!/bin/bash\nwidth=$(tput cols)\necho "$width"\n'
const COLUMNS_VAR = `#!/bin/bash\necho "\${COLUMNS:-80}"\n`
const SCRIPT = '.claude/statusline.sh'
const FILES = { [SCRIPT]: TPUT, 'scripts/bar.js': TPUT, 'scripts/ok.sh': COLUMNS_VAR }

const status = (command: unknown) => JSON.stringify({ statusLine: { type: 'command', command } })
const ids = (dir: string, command: unknown, file = PROJECT) =>
  lintJson(name, status(command), path.join(dir, file)).map((m) => m.messageId)

describe('statusline-script-terminal-size: reports', () => {
  it.each([
    '.claude/statusline.sh',
    './.claude/statusline.sh',
    `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`,
    '$CLAUDE_PROJECT_DIR/.claude/statusline.sh',
    `"\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh"`,
    "'.claude/statusline.sh'",
    '.claude/statusline.sh --compact',
    '.claude/statusline.sh | tee x',
    `bash \${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`,
    `bash "\${CLAUDE_PROJECT_DIR}/scripts/bar.js"`,
    `"$CLAUDE_PROJECT_DIR"/.claude/statusline.sh`,
    `bash "\${CLAUDE_PROJECT_DIR}"/scripts/bar.js`,
    `/bin/bash \${CLAUDE_PROJECT_DIR}/scripts/bar.js`,
    `node \${CLAUDE_PROJECT_DIR}/scripts/bar.js`,
  ])('a script that calls tput cols: %s', (command) => {
    expect(ids(tree(FILES), command), command).toEqual(['tput'])
  })

  it('reports in the local file, and on the command, with the script path in the message', () => {
    const dir = tree(FILES)
    expect(ids(dir, SCRIPT, LOCAL)).toEqual(['tput'])
    const [message] = lintJson(
      name,
      status(`bash \${CLAUDE_PROJECT_DIR}/scripts/bar.js`),
      path.join(dir, PROJECT),
    )
    expect(message?.column).toBe(43)
    expect(message?.message).toBe(
      `The status line script "\${CLAUDE_PROJECT_DIR}/scripts/bar.js" calls "tput cols". Claude Code captures the output of the script, so the call cannot read the terminal size. Read the environment variables COLUMNS and LINES.`,
    )
  })

  it('resolves a path from the project of a nested .claude folder', () => {
    const dir = tree({ 'pkg/.claude/statusline.sh': TPUT, 'pkg/.claude/settings.json': '{}' })
    expect(ids(dir, '.claude/statusline.sh', 'pkg/.claude/settings.json')).toEqual(['tput'])
    expect(
      ids(dir, `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`, 'pkg/.claude/settings.json'),
    ).toEqual(['tput'])
  })

  it('reports in a managed file for a project variable, from the repository root', () => {
    const dir = tree(FILES)
    const command = `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`
    expect(ids(dir, command, MANAGED)).toEqual(['tput'])
    expect(ids(dir, command, DROP_IN)).toEqual(['tput'])
  })

  it('finds tput cols with any spacing and after other text on the line', () => {
    for (const body of [
      'tput cols',
      'x=$(tput   cols)',
      'echo $(tput\tcols) # width',
      '  tput cols\n',
    ]) {
      expect(ids(tree({ [SCRIPT]: body }), SCRIPT), body).toEqual(['tput'])
    }
  })
})

describe('statusline-script-terminal-size: stays silent', () => {
  it('for a script that reads COLUMNS, or calls no tput', () => {
    const dir = tree(FILES)
    expect(ids(dir, 'scripts/ok.sh')).toEqual([])
    expect(ids(dir, `bash \${CLAUDE_PROJECT_DIR}/scripts/ok.sh`)).toEqual([])
    expect(
      ids(tree({ [SCRIPT]: 'tput lines\ntput colors\ntputcols\nmytput cols\n' }), SCRIPT),
    ).toEqual([])
  })

  it('for tput cols in a comment line', () => {
    expect(
      ids(tree({ [SCRIPT]: '# do not call tput cols\n  # tput cols\necho hi\n' }), SCRIPT),
    ).toEqual([])
  })

  it('for a script that is missing, or a path that is a directory', () => {
    const dir = tree(FILES)
    expect(ids(dir, '.claude/gone.sh')).toEqual([])
    expect(ids(dir, 'bash scripts/gone.js')).toEqual([])
    expect(ids(dir, 'scripts/')).toEqual([])
    expect(ids(dir, `\${CLAUDE_PROJECT_DIR}/scripts/nested/deeper.sh`)).toEqual([])
    mkdirSync(path.join(dir, 'scripts/dir.sh'))
    expect(ids(dir, 'scripts/dir.sh')).toEqual([])
  })

  it('for a command that names no repository script', () => {
    const dir = tree({ ...FILES, 'statusline.sh': TPUT })
    for (const command of [
      'statusline.sh',
      'bash',
      'bash   ',
      '',
      '   ',
      '~/.claude/statusline.sh',
      '$HOME/.claude/statusline.sh',
      '/abs/.claude/statusline.sh',
      'bash -c "tput cols"',
      'bash .claude/statusline.sh',
      'node scripts/bar.js',
      'echo scripts/bar.js',
      'cd x && scripts/bar.js',
      'cat scripts/bar.js',
      'scripts/$NAME.sh',
      `\${CLAUDE_PLUGIN_ROOT}/scripts/bar.js`,
      `\${CLAUDE_PROJECT_DIR}`,
      'scripts\\bar.js',
      'scripts/*.js',
      '"unclosed scripts/bar.js',
    ]) {
      expect(ids(dir, command), command).toEqual([])
    }
  })

  it('for a script out of the repository', () => {
    const outside = tree({ 'out.sh': TPUT }, false)
    const dir = tree(FILES)
    expect(ids(dir, '../x.sh')).toEqual([])
    expect(ids(dir, `\${CLAUDE_PROJECT_DIR}/../x.sh`)).toEqual([])
    expect(ids(dir, `${outside}/out.sh`)).toEqual([])
    expect(ids(dir, `bash ${outside}/out.sh`)).toEqual([])
  })

  it('for a script above the repository root', () => {
    const outer = tree(
      { 'scripts/bar.js': TPUT, 'repo/.git/HEAD': '', 'repo/.claude/settings.json': '{}' },
      false,
    )
    expect(ids(path.join(outer, 'repo'), 'scripts/bar.js')).toEqual([])
    expect(ids(path.join(outer, 'repo'), '../scripts/bar.js')).toEqual([])
  })

  it.skipIf(noLinks)(
    'for a script that a link reaches out of the repository, or a dangling link',
    () => {
      const outside = tree({ 'out.sh': TPUT, 'dir/in.sh': TPUT }, false)
      const dir = tree(FILES)
      link(dir, 'link-file.sh', path.join(outside, 'out.sh'))
      link(dir, 'link-dir', path.join(outside, 'dir'))
      link(dir, 'dangling.sh', 'nowhere.sh')
      for (const command of [
        'link-file.sh',
        'bash link-dir/in.sh',
        'dangling.sh',
        'dangling.sh/x',
      ]) {
        expect(ids(dir, command), command).toEqual([])
      }
    },
  )

  it.skipIf(noLinks)('reports a script that a link inside the repository reaches', () => {
    const dir = tree(FILES)
    link(dir, 'inner.sh', '.claude/statusline.sh')
    expect(ids(dir, './inner.sh')).toEqual(['tput'])
  })

  it.skipIf(chmodCannotBlock)('for a script with no read access', () => {
    const dir = tree(FILES)
    withoutAccess(path.join(dir, SCRIPT), () => {
      expect(ids(dir, SCRIPT)).toEqual([])
    })
    chmodSync(path.join(dir, SCRIPT), 0o644)
  })

  it('for a managed file with a path from the project, which it has none of', () => {
    const dir = tree(FILES)
    expect(ids(dir, '.claude/statusline.sh', MANAGED)).toEqual([])
    expect(ids(dir, 'node scripts/bar.js', DROP_IN)).toEqual([])
  })

  it('for a hidden drop-in', () => {
    expect(
      ids(
        tree(FILES),
        `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`,
        'managed-settings.d/.30-h.json',
      ),
    ).toEqual([])
  })

  it('when statusLine, its command or the file has another shape', () => {
    const dir = tree(FILES)
    for (const code of [
      '{}',
      '{"statusLine": "scripts/bar.js"}',
      '{"statusLine": {}}',
      '{"statusLine": {"command": 5}}',
      '{"statusLine": {"command": ["scripts/bar.js"]}}',
      '{"subagentStatusLine": {"command": "scripts/bar.js"}}',
      '{"fileSuggestion": {"command": "scripts/bar.js"}}',
      '[]',
    ]) {
      expect(
        lintJson(name, code, path.join(dir, PROJECT)).map((m) => m.messageId),
        code,
      ).toEqual([])
    }
  })

  it('reads the last of two keys of one name', () => {
    const dir = tree(FILES)
    const twice = (a: string, b: string) => `{"statusLine": {"command": "${a}", "command": "${b}"}}`
    expect(
      lintJson(name, twice('scripts/bar.js', 'scripts/ok.sh'), path.join(dir, PROJECT)),
    ).toEqual([])
    expect(
      lintJson(name, twice('scripts/ok.sh', 'scripts/bar.js'), path.join(dir, PROJECT)),
    ).toHaveLength(1)
  })
})

describe('statusline-script-terminal-size: the command and the project', () => {
  it.each(['sh', 'zsh', 'python', 'python3', 'deno', 'bun', 'pwsh', 'powershell', 'ruby', 'perl'])(
    'takes the first argument of the interpreter %s',
    (program) => {
      expect(ids(tree(FILES), `${program} scripts/bar.js`), program).toEqual([])
      expect(ids(tree(FILES), `${program} \${CLAUDE_PROJECT_DIR}/scripts/bar.js`), program).toEqual(
        ['tput'],
      )
    },
  )

  it('is silent for an empty quoted word', () => {
    for (const command of ['""', "''", 'bash ""', 'bash "" scripts/bar.js']) {
      expect(ids(tree(FILES), command), command).toEqual([])
    }
  })

  it('is silent for an absolute path, even when it is in the repository', () => {
    const dir = tree(FILES)
    expect(ids(dir, path.join(dir, 'scripts/bar.js'))).toEqual([])
  })

  it('is silent for a character that a shell expands after the project variable', () => {
    const dir = tree({ 'scripts/a*b.sh': TPUT, 'scripts/x.sh': TPUT })
    for (const command of [
      `"\${CLAUDE_PROJECT_DIR}/scripts/a*b.sh"`,
      `\${CLAUDE_PROJECT_DIR}/scripts/$NAME.sh`,
      `x$CLAUDE_PROJECT_DIR/scripts/x.sh`,
    ]) {
      expect(ids(dir, command), command).toEqual([])
      expect(ids(dir, command, MANAGED), command).toEqual([])
    }
  })

  it('is silent for an absolute path after the project variable', () => {
    const dir = tree(FILES)
    expect(ids(dir, `\${CLAUDE_PROJECT_DIR}/${path.join(dir, 'scripts/bar.js')}`)).toEqual([])
    expect(ids(dir, `\${CLAUDE_PROJECT_DIR}//scripts/bar.js`)).toEqual([])
  })

  it('ends the program word at a shell operator', () => {
    const dir = tree(FILES)
    for (const command of [
      '.claude/statusline.sh|cat',
      '.claude/statusline.sh;echo x',
      '.claude/statusline.sh>/dev/null',
      '.claude/statusline.sh&',
      '.claude/statusline.sh<x',
    ]) {
      expect(ids(dir, command), command).toEqual(['tput'])
    }
  })

  it('reads a script in the repository outside the folder of the project', () => {
    const dir = tree({ 'scripts/bar.js': TPUT, 'pkg/.claude/settings.json': '{}' })
    expect(ids(dir, '../scripts/bar.js', 'pkg/.claude/settings.json')).toEqual(['tput'])
  })

  it.skipIf(noLinks)('does not resolve a character that a shell expands', () => {
    // Each file exists under the literal name, so only the guard can make the rule silent.
    const names = [
      'a=b',
      'a{b}',
      'a[1]',
      'a#b',
      'a!b',
      'a?b',
      'a:b',
      'a*b',
      'a~b',
      'a$b',
      'a`b',
      'a\\b',
      'a[b',
      'a]b',
      'a{b',
      'a}b',
    ]
    const dir = tree(Object.fromEntries(names.map((n) => [`scripts/${n}.sh`, TPUT])))
    for (const n of names) {
      expect(ids(dir, `'scripts/${n}.sh'`), n).toEqual([])
    }
  })

  it('resolves a project variable of a nested managed file from the repository root', () => {
    const dir = tree({
      [SCRIPT]: TPUT,
      'pkg/.claude/other.sh': TPUT,
      'pkg/managed-settings.json': '{}',
    })
    const command = `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`
    expect(ids(dir, command, 'pkg/managed-settings.json')).toEqual(['tput'])
    expect(
      ids(dir, `\${CLAUDE_PROJECT_DIR}/.claude/other.sh`, 'pkg/managed-settings.json'),
    ).toEqual([])
  })

  it('finds the project of a managed file in a tree with no .git', () => {
    const dir = tree(FILES, false)
    const command = `\${CLAUDE_PROJECT_DIR}/.claude/statusline.sh`
    expect(ids(dir, command, MANAGED)).toEqual(['tput'])
    expect(ids(dir, command, DROP_IN)).toEqual(['tput'])
  })

  it.skipIf(noLinks)(
    'bounds the read at the repository of the project, not of its link target',
    () => {
      const elsewhere = tree({ '.claude/settings.json': '{}', 's.sh': TPUT }, false)
      const dir = tree({ 'pkg/.keep': '' })
      rmSync(path.join(dir, 'pkg'), { recursive: true })
      link(dir, 'pkg', elsewhere)
      expect(ids(dir, `\${CLAUDE_PROJECT_DIR}/s.sh`, 'pkg/.claude/settings.json')).toEqual([])
    },
  )
})
