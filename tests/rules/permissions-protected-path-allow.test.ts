// Allow rules in settings do not pre-approve a write to a protected path, an `allowWrite` entry
// cannot lift a protected path of the sandbox, and no allow rule approves `rm` or `rmdir` on a
// critical path:
// https://code.claude.com/docs/en/permission-modes#protected-paths
// https://code.claude.com/docs/en/permission-modes#critical-paths
// https://code.claude.com/docs/en/sandboxing#protected-paths
// `Write(path)` rules are for `permissions-path-rule-tool`, so this rule reads `Edit` rules only.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-protected-path-allow'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const NESTED = '/repo/packages/a/.claude/settings.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const LOCAL_NAMED_DROP_IN = '/repo/managed-settings.d/settings.local.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'
const PROJECT_FILES = [PROJECT, LOCAL, NESTED]
const MANAGED_FILES = [MANAGED, DROP_IN, LOCAL_NAMED_DROP_IN]

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const allow = (...rules: string[]) => ({ permissions: { allow: rules } })
const write = (...entries: unknown[]) => ({ sandbox: { filesystem: { allowWrite: entries } } })

describe(`${name}: an Edit allow rule`, () => {
  it('reports the example of the docs, in a project, local or managed file', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      expect(ids(allow('Edit(.claude/**)'), file), file).toEqual(['protectedEdit'])
    }
  })

  it('reports each protected directory of the docs', () => {
    for (const dir of [
      '.git',
      '.config/git',
      '.vscode',
      '.idea',
      '.husky',
      '.cargo',
      '.devcontainer',
      '.yarn',
      '.mvn',
      '.claude',
    ]) {
      expect(ids(allow(`Edit(${dir}/**)`)), dir).toEqual(['protectedEdit'])
    }
  })

  it('reports a protected file of the docs', () => {
    for (const file of [
      '.gitconfig',
      '.bashrc',
      '.zshrc',
      '.envrc',
      '.npmrc',
      'bunfig.toml',
      '.pre-commit-config.yaml',
      'lefthook.yml',
      'pyrightconfig.json',
      '.mcp.json',
      '.claude.json',
    ]) {
      expect(ids(allow(`Edit(${file})`)), file).toEqual(['protectedEdit'])
    }
  })

  it('reports every path form that starts at a protected path', () => {
    for (const rule of [
      'Edit(.claude/settings.json)',
      'Edit(.claude/skills/x/SKILL.md)',
      'Edit(.claude/*)',
      'Edit(.claude/)',
      'Edit(./.git/hooks/*)',
      'Edit(/.claude/**)',
      'Edit(~/.claude/**)',
      'Edit(~/.zshrc)',
      'Edit(**/.claude/**)',
      'Edit(**/**/.git/**)',
      'Edit(//**/.git/**)',
      'Edit(**/.npmrc)',
      'Edit(.husky/pre-commit)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual(['protectedEdit'])
    }
  })

  it('names the rule and the protected path, and says that the check comes first', () => {
    const [message] = lint(allow('Edit(**/.git/**)'))
    expect(message?.message).toContain('`Edit(**/.git/**)`')
    expect(message?.message).toContain('`.git`')
    expect(message?.message).toContain('before it reads allow rules')
  })

  it('reports each entry once, and the entry at its line, column and end', () => {
    const [message, ...rest] = lint(JSON.stringify(allow('Edit(.git/**)', 'Edit(src/**)')))
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 41,
    ])
  })

  it('is silent for a path that is not under a protected path', () => {
    for (const rule of [
      'Edit',
      'Edit()',
      'Edit(**)',
      'Edit(src/**)',
      'Edit(/src/**)',
      'Edit(.github/**)',
      'Edit(.gitignore)',
      'Edit(.config/**)',
      'Edit(.config)',
      'Edit(.claude.local)',
      'Edit(docs/.vscode/**)',
      'Edit(src/.git/**)',
      'Edit(.git*)',
      'Edit(.claude*/**)',
      'Edit(.*)',
      'Edit(*.json)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for the directories that the docs except under .claude', () => {
    for (const dir of ['worktrees', 'plans', 'jobs/x/tmp', 'projects', 'agent-memory']) {
      expect(ids(allow(`Edit(.claude/${dir}/**)`)), dir).toEqual([])
      expect(ids(allow(`Edit(~/.claude/${dir}/**)`)), dir).toEqual([])
    }
  })

  it('is silent for an absolute path, which names no directory of the project', () => {
    expect(
      ids(allow('Edit(//home/me/proj/.git/**)', 'Edit(//.git/**)', 'Edit(//etc/.claude)')),
    ).toEqual([])
  })

  it('is silent for Write: permissions-path-rule-tool reports a path rule for it', () => {
    expect(ids(allow('Write(.claude/**)', 'NotebookEdit(.git/**)', 'Read(.git/**)'))).toEqual([])
  })

  it('is silent in deny and ask, which do not depend on this check', () => {
    expect(ids({ permissions: { deny: ['Edit(.claude/**)'], ask: ['Edit(.git/**)'] } })).toEqual([])
  })
})

describe(`${name}: an allow rule for rm or rmdir`, () => {
  it('reports a target that is a critical path of the docs', () => {
    for (const target of [
      '/',
      '~',
      '~/',
      '$HOME',
      `\${HOME}`,
      '/usr',
      '/etc/',
      '.',
      './',
      '..',
      '../',
    ]) {
      expect(ids(allow(`Bash(rm -rf ${target})`)), target).toEqual(['criticalRemoval'])
    }
  })

  it('reports rmdir, a quoted target, and a critical target among others', () => {
    for (const rule of [
      'Bash(rmdir /usr)',
      'Bash(rm -rf "/")',
      "Bash(rm -rf '$HOME')",
      'Bash(rm -rf build /)',
      'Bash(rm -rf -- /)',
      'Bash(rm -r -f /var)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual(['criticalRemoval'])
    }
  })

  it('reports in a project, local or managed file, and says that no allow rule approves it', () => {
    for (const file of [...PROJECT_FILES, ...MANAGED_FILES]) {
      const [message] = lint(allow('Bash(rm -rf /)'), file)
      expect(message?.messageId, file).toBe('criticalRemoval')
      expect(message?.message, file).toContain('`Bash(rm -rf /)`')
      expect(message?.message, file).toContain('critical path')
    }
  })

  it('reports the entry, at its line, column and end', () => {
    const [message] = lint(JSON.stringify(allow('Bash(rm -rf /)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 26, 1, 42,
    ])
  })

  it('is silent for a target that is not a critical path', () => {
    for (const rule of [
      'Bash(rm -rf build)',
      'Bash(rm -rf /tmp/build)',
      'Bash(rm -rf ./build)',
      'Bash(rm -rf ~/build)',
      'Bash(rm -rf $HOME/build)',
      'Bash(rm -rf ~user)',
      'Bash(rm -rf ...)',
      'Bash(rmdir build)',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for a rule that has a wildcard, which approves other targets too', () => {
    for (const rule of ['Bash(rm *)', 'Bash(rm -rf /*)', 'Bash(rm -rf /tmp/*)', 'Bash(rm:*)']) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent when the command is not rm or rmdir, or has no target', () => {
    for (const rule of [
      'Bash(rm)',
      'Bash(rm -rf)',
      'Bash(ls /)',
      'Bash(echo rm -rf /)',
      'Bash(sudo rm -rf /)',
      'Bash(trash /)',
      'Bash()',
    ]) {
      expect(ids(allow(rule)), rule).toEqual([])
    }
  })

  it('is silent for PowerShell and Monitor, which the docs treat on their own', () => {
    expect(ids(allow('PowerShell(rm -rf /)', 'Monitor(rm -rf /)'))).toEqual([])
  })

  it('is silent in deny and ask, where a rule blocks the command', () => {
    expect(ids({ permissions: { deny: ['Bash(rm -rf /)'], ask: ['Bash(rm -rf ~)'] } })).toEqual([])
  })
})

describe(`${name}: sandbox.filesystem.allowWrite`, () => {
  it('reports the entry that is a protected path of the sandbox, in a project or local file', () => {
    for (const file of PROJECT_FILES) {
      expect(ids(write('.claude/skills'), file), file).toEqual(['protectedSandbox'])
    }
  })

  it('reports each protected path of the sandbox, and a path beneath one', () => {
    for (const entry of [
      '.claude/settings.json',
      '.claude/settings.local.json',
      '.claude/skills',
      './.claude/agents/',
      '.claude/commands',
      '.claude/hooks/**',
      '.claude/workflows',
      '.claude/scheduled_tasks.json',
      '.mcp.json',
      '.bashrc',
      '.zshrc',
      '.gitconfig',
      '.vscode',
      '.idea/workspace.xml',
      '.git/hooks',
      '.git/hooks/pre-commit',
      '.git/config',
    ]) {
      expect(ids(write(entry)), entry).toEqual(['protectedSandbox'])
    }
  })

  it('says that an allowWrite entry cannot lift the protection, and names the path', () => {
    const [message] = lint(write('./.claude/skills/'))
    expect(message?.message).toContain('`./.claude/skills/`')
    expect(message?.message).toContain('`.claude/skills`')
    expect(message?.message).toContain('cannot lift')
  })

  it('reports each entry once, at its line, column and end', () => {
    const [message, ...rest] = lint(JSON.stringify(write('.git/hooks', 'build')))
    expect(rest).toEqual([])
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 41, 1, 53,
    ])
  })

  it('reports a rule and an entry of one file', () => {
    expect(
      ids({ permissions: { allow: ['Edit(.git/**)'] }, sandbox: write('.vscode').sandbox }),
    ).toEqual(['protectedEdit', 'protectedSandbox'])
  })

  it('is silent for an entry above a protected path, which allows other paths too', () => {
    for (const entry of [
      '.claude',
      '.git',
      '.',
      './',
      '.claude/projects',
      '.claude/skills-cache',
    ]) {
      expect(ids(write(entry)), entry).toEqual([])
    }
  })

  it('is silent for a path that is not protected', () => {
    for (const entry of ['build', './out/**', 'node_modules/.cache', 'src/.vscode', '.bashrc.d']) {
      expect(ids(write(entry)), entry).toEqual([])
    }
  })

  it('is silent for a path that is not relative to the project', () => {
    for (const entry of ['~/.claude/skills', '/tmp/build', '//tmp/build', '/repo/.claude/skills']) {
      expect(ids(write(entry)), entry).toEqual([])
    }
  })

  it('is silent for an entry with a wildcard, which the sandbox may skip', () => {
    for (const entry of ['.claude/skills/*', '.vscode/*.json', '.git/hoo?s', '.claude/[s]kills']) {
      expect(ids(write(entry)), entry).toEqual([])
    }
  })

  it('is silent in a managed file, where the docs do not say what a relative path means', () => {
    for (const file of MANAGED_FILES) {
      expect(ids(write('.claude/skills'), file), file).toEqual([])
    }
  })

  it('is silent for a list that is not allowWrite', () => {
    expect(
      ids({
        sandbox: {
          filesystem: {
            denyWrite: ['.claude/skills'],
            allowRead: ['.claude/skills'],
            denyRead: ['.git/hooks'],
          },
        },
      }),
    ).toEqual([])
  })

  it('is silent for an entry that is no string, and a value that is no list', () => {
    expect(ids(write(3, null, ['.git/hooks'], { a: 1 }))).toEqual([])
    expect(ids({ sandbox: { filesystem: { allowWrite: '.git/hooks' } } })).toEqual([])
    expect(ids({ sandbox: { filesystem: '.git/hooks' } })).toEqual([])
    expect(ids({ sandbox: '.git/hooks' })).toEqual([])
    expect(ids('[1]')).toEqual([])
  })

  it('reads the last of two keys of one name', () => {
    expect(
      ids('{"sandbox": {"filesystem": {"allowWrite": [".git/hooks"], "allowWrite": ["build"]}}}'),
    ).toEqual([])
    expect(
      ids('{"sandbox": {"filesystem": {"allowWrite": ["build"], "allowWrite": [".git/hooks"]}}}'),
    ).toEqual(['protectedSandbox'])
  })
})

describe(`${name}: the rules that it leaves alone`, () => {
  it('is silent for a rule that does not parse: permissions-rule-syntax reports it', () => {
    expect(ids(allow('Edit(.git/**', 'Bash(rm -rf /'))).toEqual([])
  })

  it('is silent for an entry that is no string, and a list that is no array', () => {
    expect(ids({ permissions: { allow: [3, null] } })).toEqual([])
    expect(ids({ permissions: { allow: 'Edit(.git/**)' } })).toEqual([])
  })

  it('is silent in a hidden drop-in, which Claude Code ignores', () => {
    expect(ids(allow('Edit(.git/**)', 'Bash(rm -rf /)'), HIDDEN)).toEqual([])
    expect(ids(write('.git/hooks'), HIDDEN)).toEqual([])
  })
})
