// The `shell` key of a skill or command with injected commands. `shell: bash` fails on Windows
// without Git Bash. `shell: powershell` runs the commands in Bash where the PowerShell tool is off.
// The rule is inactive until the option `platforms` lists a platform.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const withShell = (shell: string, body = '!`date`') =>
  `---\ndescription: d\nshell: ${shell}\n---\n\n${body}\n`

const NO_BASH = [{ platforms: ['windows-no-git-bash'] }]
const NO_POWERSHELL = ['macos', 'linux', 'wsl', 'bedrock', 'vertex', 'foundry']
const bash = (extra: object = {}) => ({ messageId: 'bash' as const, ...extra })
const powershell = (platforms: string, extra: object = {}) => ({
  messageId: 'powershell' as const,
  data: { platforms },
  ...extra,
})

markdownTester.run('skill-shell-platform', ruleOf('skill-shell-platform'), {
  valid: [
    // With no `platforms`, the rule is inactive.
    { code: withShell('bash'), filename: skill },
    { code: withShell('powershell'), filename: skill },
    { code: withShell('bash'), filename: skill, options: [{}] },
    { code: withShell('powershell'), filename: skill, options: [{ platforms: [] }] },
    // A placeholder in the frontmatter is no injected command.
    {
      code: '---\ndescription: Runs !`date`\nshell: bash\n---\n\nplain body\n',
      filename: skill,
      options: NO_BASH,
    },
    // A platform where the value works.
    { code: withShell('bash'), filename: skill, options: [{ platforms: ['macos', 'linux'] }] },
    { code: withShell('powershell'), filename: skill, options: NO_BASH },
    // No `shell` key: Claude Code uses the tool that works.
    { code: '---\ndescription: d\n---\n\n!`date`\n', filename: skill, options: NO_BASH },
    {
      code: '---\ndescription: d\n---\n\n!`date`\n',
      filename: skill,
      options: [{ platforms: ['macos', 'windows-no-git-bash'] }],
    },
    // The `shell` value is not `bash` or `powershell`. The schema rule reports it.
    { code: withShell('zsh'), filename: skill, options: [{ platforms: ['macos'] }] },
    { code: withShell('5'), filename: skill, options: NO_BASH },
    { code: withShell('[bash]'), filename: skill, options: NO_BASH },
    // No injected command.
    { code: withShell('bash', 'Run the date command.'), filename: skill, options: NO_BASH },
    {
      code: withShell('powershell', 'No commands.'),
      filename: skill,
      options: [{ platforms: ['macos'] }],
    },
    // A placeholder in fenced code that is not a `!` block is text.
    { code: withShell('bash', '```bash\n!`date`\n```'), filename: skill, options: NO_BASH },
    // A placeholder that is not at the start of a line or after whitespace stays text.
    { code: withShell('bash', 'Run x!`date` now'), filename: skill, options: NO_BASH },
    // A placeholder in a code span is code text.
    {
      code: withShell('bash', 'Write `` !`date` `` to run it.'),
      filename: skill,
      options: NO_BASH,
    },
    // The `shell` key outside the frontmatter is body text.
    { code: '# S\n\nshell: bash\n\n!`date`\n', filename: skill, options: NO_BASH },
    // An empty block, a block that does not parse, and a file with no frontmatter.
    { code: '---\n---\n\n!`date`\n', filename: skill, options: NO_BASH },
    { code: '---\nshell: [bash\n---\n\n!`date`\n', filename: skill, options: NO_BASH },
    { code: '!`date`\n', filename: skill, options: NO_BASH },
    // Not a skill or command file.
    { code: withShell('bash'), filename: 'docs/SKILL.md', options: NO_BASH },
    { code: withShell('bash'), filename: 'docs/readme.md', options: NO_BASH },
  ],
  invalid: [
    {
      code: withShell('bash'),
      filename: skill,
      options: NO_BASH,
      errors: [bash({ line: 3, column: 8, endLine: 3, endColumn: 12 })],
    },
    // Each form of an injected command.
    {
      code: withShell('bash', 'Run: !`date`'),
      filename: skill,
      options: NO_BASH,
      errors: [bash()],
    },
    {
      code: withShell('bash', '```!\ndate\n```'),
      filename: skill,
      options: NO_BASH,
      errors: [bash()],
    },
    {
      code: withShell('bash', '~~~!\ndate\n~~~'),
      filename: skill,
      options: NO_BASH,
      errors: [bash()],
    },
    // A code span elsewhere on the line does not hide a placeholder.
    {
      code: withShell('bash', '`x` then !`date`'),
      filename: skill,
      options: NO_BASH,
      errors: [bash()],
    },
    // A command file, in a project and in a plugin, and a plugin skill.
    { code: withShell('bash'), filename: command, options: NO_BASH, errors: [bash()] },
    { code: withShell('bash'), filename: pluginCommand(), options: NO_BASH, errors: [bash()] },
    { code: withShell('bash'), filename: pluginSkill(), options: NO_BASH, errors: [bash()] },
    // `shell: powershell` on each platform where the PowerShell tool is off by default.
    ...NO_POWERSHELL.map((platform) => ({
      code: withShell('powershell'),
      filename: skill,
      options: [{ platforms: [platform] }],
      errors: [powershell(platform, { line: 3, column: 8, endLine: 3, endColumn: 18 })],
    })),
    {
      code: withShell('powershell'),
      filename: skill,
      options: [{ platforms: ['windows-no-git-bash', 'macos', 'wsl'] }],
      errors: [powershell('macos, wsl')],
    },
    {
      code: withShell('powershell', '```!\nGet-Date\n```'),
      filename: command,
      options: [{ platforms: ['linux'] }],
      errors: [powershell('linux')],
    },
    // With both kinds of platform listed, `bash` gets the bash report only.
    {
      code: withShell('bash'),
      filename: skill,
      options: [{ platforms: ['macos', 'windows-no-git-bash'] }],
      errors: [bash()],
    },
  ],
})

describe('the messages', () => {
  const messages = (shell: string, platforms: string[]) =>
    lintMarkdown('skill-shell-platform', withShell(shell), skill, [{ platforms }]).map(
      (m) => m.message,
    )

  it('says that bash fails before any command runs', () => {
    expect(messages('bash', ['windows-no-git-bash'])).toEqual([
      '`shell: bash` fails the invocation on Windows without Git Bash, before any injected command runs. Remove `shell`, or drop `windows-no-git-bash` from the option `platforms`.',
    ])
  })

  it('says that the PowerShell tool is off, and names the platforms', () => {
    expect(messages('powershell', ['macos', 'linux'])).toEqual([
      '`shell: powershell` needs the PowerShell tool. It is off by default on macos, linux, and the injected commands then run in Bash. Set `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` there, or drop the platform from the option `platforms`.',
    ])
  })
})

describe('the option', () => {
  const lint = (option: unknown) =>
    lintMarkdown('skill-shell-platform', withShell('bash'), skill, [option])

  it.each([
    { platform: ['macos'] },
    { platforms: 'macos' },
    { platforms: ['windows'] },
    { platforms: ['macOS'] },
    { platforms: [5] },
    { platforms: ['macos', 'macos'] },
    { platforms: ['macos'], extra: 1 },
  ])('refuses %j', (option) => {
    expect(() => lint(option)).toThrow('Key "claude/skill-shell-platform"')
  })

  it('takes each platform', () => {
    expect(() => lint({ platforms: ['windows-no-git-bash', ...NO_POWERSHELL] })).not.toThrow()
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'skill-shell-platform-'))
    try {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'repo', 'real', '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(scratch, 'outside', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(scratch, 'repo', 'real', '.claude-plugin', 'plugin.json'), '{}')
      writeFileSync(path.join(scratch, 'outside', '.claude-plugin', 'plugin.json'), '{}')
      symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
      const lint = (dir: string) =>
        lintMarkdown(
          'skill-shell-platform',
          withShell('bash'),
          path.join(scratch, 'repo', dir, 'SKILL.md'),
          NO_BASH,
        )
      expect(lint('plug')).toEqual([])
      expect(lint('real')).toHaveLength(1)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
