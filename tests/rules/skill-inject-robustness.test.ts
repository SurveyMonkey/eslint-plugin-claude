// An injected command aborts the whole skill invocation when it fails or when no permission rule
// allows it. The rule reads the commands as text, in the inline form (`!` and a code span) and in
// a fence with the info string `!`. It reads the Bash rules of `allowed-tools` only, never a
// settings file. It skips the read-only commands that the permissions page names, and `git`.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pluginCommand, pluginSkill } from '../plugin-fixture.test-support.ts'
import { lintMarkdown, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
const tick = '`'
// The variables, escaped so that the template literal keeps them as text.
const skillDir = `\${CLAUDE_SKILL_DIR}`
const projectDir = `\${CLAUDE_PROJECT_DIR}`
const pluginRoot = `\${CLAUDE_PLUGIN_ROOT}`

/** The inline form of a command. */
const inline = (text: string) => `!${tick}${text}${tick}`
/** The block form of a command. */
const block = (text: string) => `${tick.repeat(3)}!\n${text}\n${tick.repeat(3)}`
/** A file with the `allowed-tools` field `tools` and the body `body`. */
const withTools = (tools: string, body: string) => `---\nallowed-tools: ${tools}\n---\n\n${body}\n`

const unmatched = (found: string, line = 5, column = 2) => ({
  messageId: 'unmatched' as const,
  data: { found },
  line,
  column,
})
const relative = (found: string) => ({
  messageId: 'relativePath' as const,
  data: { found, skillDir, projectDir },
})
const check = (found: string) => ({ messageId: 'checkExit' as const, data: { found } })
const nested = { messageId: 'nested' as const, data: { found: '!`' } }

markdownTester.run('skill-inject-robustness', ruleOf('skill-inject-robustness'), {
  valid: [
    // A rule that matches the command: a prefix rule, the bare command, and an exact rule.
    { code: withTools('Bash(gh *)', inline('gh pr diff')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh')), filename: skill },
    { code: withTools('Bash(gh pr diff)', inline('gh pr diff')), filename: skill },
    { code: withTools('Bash(npm run:*)', inline('npm run build')), filename: skill },
    { code: withTools('Bash(npm run:*)', inline('npm run')), filename: skill },
    { code: withTools('Bash(npm*)', inline('npmx test')), filename: skill },
    { code: withTools('Bash(* --version)', inline('node --version')), filename: skill },
    { code: withTools('Bash(* --help *)', inline('npm --help x')), filename: skill },
    { code: withTools('Bash(npm * build)', inline('npm run build')), filename: skill },
    // A grant of every Bash command.
    { code: withTools('Bash', inline('npm test')), filename: skill },
    { code: withTools('Bash(*)', inline('npm test')), filename: skill },
    // A list of rules, as a string and as a YAML list.
    { code: withTools('Bash(gh *) Bash(npm *)', inline('npm test')), filename: skill },
    { code: withTools('Bash(gh *), Bash(npm *)', inline('npm test')), filename: skill },
    {
      code: `---\nallowed-tools:\n  - Read\n  - Bash(npm *)\n---\n\n${inline('npm test')}\n`,
      filename: skill,
    },
    // The characters of a regular expression in a rule are literal text.
    { code: withTools('Bash(npm run test+(x) *)', inline('npm run test+(x) a')), filename: skill },
    { code: withTools('Bash(a.b *)', inline('a.b c')), filename: skill },
    // Each subcommand of a compound command has a rule, or is a read-only command.
    { code: withTools('Bash(gh *)', inline('gh pr view && gh pr diff')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff | head -5')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff || echo none')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff; ls')), filename: skill },
    // The fallback that the docs give needs no rule.
    { code: withTools('Bash(gh *)', inline('gh pr diff || true')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff || :')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff & ls')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr diff |& cat')), filename: skill },
    // A separator in a quoted string, or in a redirection, does not split the command.
    { code: withTools('Bash(gh *)', inline('gh pr list --search "a && b"')), filename: skill },
    { code: withTools('Bash(gh *)', inline("gh pr list --search 'a | b'")), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr list 2>&1')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr list &>/dev/null')), filename: skill },
    { code: withTools('Bash(gh *)', inline('gh pr list >&2')), filename: skill },
    // A line break after a backslash does not split the command.
    { code: withTools('Bash(gh *)', block('gh pr \\\n  diff')), filename: skill },
    // A quoted string with a line break is part of one command.
    { code: withTools('Bash(npm *)', block('npm run x "a\nb"')), filename: skill },
    // The commands of the permissions page that run without a prompt need no rule.
    { code: inline('ls -la'), filename: skill },
    { code: inline('cat notes.md'), filename: skill },
    { code: inline('echo hello'), filename: skill },
    { code: inline('pwd'), filename: skill },
    { code: inline('grep -r todo .'), filename: skill },
    { code: inline('wc -l file'), filename: skill },
    { code: inline('cd src && ls'), filename: skill },
    // The rule does not judge `git`, a wrapper or a leading variable.
    { code: inline('git status --short'), filename: skill },
    { code: inline('git push origin main'), filename: skill },
    { code: inline('timeout 5 npm test'), filename: skill },
    { code: inline('NODE_ENV=test npm test'), filename: skill },
    { code: inline('nohup npm start'), filename: skill },
    // A skill with no frontmatter has no rules, and a read-only command needs none.
    { code: `# Title\n\n${inline('pwd')}\n`, filename: skill },
    // The rule cannot read a block that does not parse, and a `powershell` shell needs other rules.
    { code: `---\nname: [unclosed\n---\n\n${inline('npm test')}\n`, filename: skill },
    {
      code: `---\nshell: powershell\n---\n\n${inline('npm test')}\n`,
      filename: skill,
    },
    // The same checks run on a command file and on a plugin skill.
    { code: withTools('Bash(npm *)', inline('npm test')), filename: command },
    { code: withTools('Bash(npm *)', inline('npm test')), filename: pluginSkill() },
    { code: withTools('Bash(npm *)', inline('npm test')), filename: pluginCommand() },
    // Paths that do not depend on the working directory.
    { code: withTools('Bash', inline(`${skillDir}/scripts/run.sh`)), filename: skill },
    { code: withTools('Bash', inline(`${projectDir}/scripts/run.sh`)), filename: pluginSkill() },
    { code: withTools('Bash', inline(`${pluginRoot}/scripts/run.sh`)), filename: pluginSkill() },
    { code: withTools('Bash', inline(`bash ${skillDir}/scripts/run.sh`)), filename: skill },
    { code: withTools('Bash', inline(`node "${skillDir}/scripts/run.js"`)), filename: skill },
    { code: withTools('Bash', inline('/usr/local/bin/tool --flag')), filename: skill },
    { code: withTools('Bash', inline('~/bin/tool --flag')), filename: skill },
    { code: withTools('Bash', inline('$HOME/bin/tool --flag')), filename: skill },
    { code: withTools('Bash', inline('bash /opt/tool/run.sh')), filename: skill },
    // A program with no path, an interpreter with a flag or with no argument.
    { code: withTools('Bash', inline('gh pr diff')), filename: skill },
    { code: withTools('Bash', inline('npm run lint')), filename: skill },
    { code: withTools('Bash', inline("bash -c 'x/y'")), filename: skill },
    { code: withTools('Bash', inline('python3 -c "print(1)"')), filename: skill },
    { code: withTools('Bash', inline('node --version')), filename: skill },
    { code: withTools('Bash', inline('bash')), filename: skill },
    { code: withTools('Bash', inline('python3 module_name')), filename: skill },
    // A check script with a fallback, a name that only contains a check word, a name in the
    // folder and not in the file, and a check script that is not the last command.
    { code: withTools('Bash', inline(`${skillDir}/check.sh || true`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/check.sh || :`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/check.sh || echo failed`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/checker.sh`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/recheck.sh`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/prelint2.sh`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/check/run.sh`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/check.sh | tee log`)), filename: skill },
    { code: withTools('Bash', inline(`${skillDir}/check.sh; echo done`)), filename: skill },
    { code: withTools('Bash', block(`${skillDir}/check.sh\necho done`)), filename: skill },
    { code: withTools('Bash', inline(`bash ${skillDir}/check.sh || true`)), filename: skill },
    // Text that is not an injected command: a code span with no `!`, a placeholder that is
    // not at the start of a line or after whitespace, an ordinary fence, and an indented block.
    { code: withTools('Bash(gh *)', `Run ${tick}npm test${tick} first.`), filename: skill },
    { code: withTools('Bash(gh *)', `KEY=${inline('npm test')}`), filename: skill },
    { code: withTools('Bash(gh *)', `a${inline('npm test')}`), filename: skill },
    {
      code: withTools('Bash(gh *)', `${tick.repeat(3)}bash\nnpm test\n${tick.repeat(3)}`),
      filename: skill,
    },
    {
      code: withTools(
        'Bash(gh *)',
        `${tick.repeat(3)}\n!${tick}npm test${tick}\n${tick.repeat(3)}`,
      ),
      filename: skill,
    },
    { code: withTools('Bash(gh *)', '    npm test'), filename: skill },
    // A command with no text.
    { code: withTools('Bash(gh *)', `!${tick} ${tick}`), filename: skill },
    // A block that prints no placeholder.
    { code: withTools('Bash', block("echo 'date'")), filename: skill },
    // A file that is no skill or command file.
    { code: inline('npm test'), filename: 'README.md' },
    { code: inline('./run.sh'), filename: 'docs/SKILL.md' },
  ],
  invalid: [
    // No rule matches. The report is at the code span.
    {
      code: withTools('Bash(gh *)', inline('npm test')),
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    { code: inline('npm test'), filename: skill, errors: [unmatched('npm test', 1, 2)] },
    // Only the first subcommand without a rule is named, and a read-only one is skipped.
    {
      code: withTools('Bash(gh *)', inline('ls && npm test && make')),
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    {
      code: withTools('Bash(gh *)', inline('gh pr diff && npm test')),
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    // A rule that is close, but does not match.
    {
      code: withTools('Bash(npm *)', inline('npmx test')),
      filename: skill,
      errors: [unmatched('npmx test', 5, 2)],
    },
    {
      code: withTools('Bash(npm run)', inline('npm run build')),
      filename: skill,
      errors: [unmatched('npm run build', 5, 2)],
    },
    {
      code: withTools('Bash(npm run *)', inline('npm install')),
      filename: skill,
      errors: [unmatched('npm install', 5, 2)],
    },
    {
      code: withTools('Bash(* --help *)', inline('npm --help')),
      filename: skill,
      errors: [unmatched('npm --help', 5, 2)],
    },
    {
      code: withTools('Bash(* --version)', inline('node -v')),
      filename: skill,
      errors: [unmatched('node -v', 5, 2)],
    },
    {
      code: withTools('Bash(npm:* run)', inline('npm run')),
      filename: skill,
      errors: [unmatched('npm run', 5, 2)],
    },
    {
      code: withTools('Bash(a.b *)', inline('aXb c')),
      filename: skill,
      errors: [unmatched('aXb c', 5, 2)],
    },
    {
      code: withTools('Bash(npm run test+(x) *)', inline('npm run testtx a')),
      filename: skill,
      errors: [unmatched('npm run testtx a', 5, 2)],
    },
    // A rule for another tool, a deny rule and a rule that does not parse do not allow a command.
    {
      code: withTools('Read', inline('npm test')),
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    {
      code: `---\ndisallowed-tools: Bash(npm *)\n---\n\n${inline('npm test')}\n`,
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    {
      code: withTools('"Bash("', inline('npm test')),
      filename: skill,
      errors: [unmatched('npm test', 5, 2)],
    },
    // The block form, with the report on the fence.
    {
      code: withTools('Bash(gh *)', block('gh pr diff\nnpm test')),
      filename: skill,
      errors: [{ ...unmatched('npm test', 5, 1), endLine: 8 }],
    },
    // A command file and a plugin skill.
    { code: inline('npm test'), filename: command, errors: [unmatched('npm test', 1, 2)] },
    { code: inline('npm test'), filename: pluginSkill(), errors: [unmatched('npm test', 1, 2)] },
    { code: inline('npm test'), filename: pluginCommand(), errors: [unmatched('npm test', 1, 2)] },
    // The start of a line, and after a space, a tab and a line break.
    { code: `x ${inline('npm test')}`, filename: skill, errors: [unmatched('npm test', 1, 4)] },
    { code: `x\t${inline('npm test')}`, filename: skill, errors: [unmatched('npm test', 1, 4)] },
    { code: `x\n${inline('npm test')}`, filename: skill, errors: [unmatched('npm test', 2, 2)] },
    // One report for each command.
    {
      code: `${inline('npm test')}\n${inline('make')}\n`,
      filename: skill,
      errors: [unmatched('npm test', 1, 2), unmatched('make', 2, 2)],
    },
    // A relative script path.
    {
      code: withTools('Bash', inline('./scripts/run.sh')),
      filename: skill,
      errors: [relative('./scripts/run.sh')],
    },
    {
      code: withTools('Bash', inline('../tools/run.sh')),
      filename: skill,
      errors: [relative('../tools/run.sh')],
    },
    {
      code: withTools('Bash', inline('scripts/run.sh')),
      filename: skill,
      errors: [relative('scripts/run.sh')],
    },
    {
      code: withTools('Bash', inline('"./scripts/run.sh" --flag')),
      filename: skill,
      errors: [relative('./scripts/run.sh')],
    },
    {
      code: withTools('Bash', inline("'./scripts/run.sh'")),
      filename: skill,
      errors: [relative('./scripts/run.sh')],
    },
    {
      code: withTools('Bash', inline('bash scripts/run.sh')),
      filename: skill,
      errors: [relative('scripts/run.sh')],
    },
    {
      code: withTools('Bash', inline('sh ./run.sh')),
      filename: skill,
      errors: [relative('./run.sh')],
    },
    {
      code: withTools('Bash', inline('python3 run.py')),
      filename: skill,
      errors: [relative('run.py')],
    },
    {
      code: withTools('Bash', inline('node build.js')),
      filename: skill,
      errors: [relative('build.js')],
    },
    { code: withTools('Bash', inline('ruby x.rb')), filename: skill, errors: [relative('x.rb')] },
    { code: withTools('Bash', inline('node ./x')), filename: skill, errors: [relative('./x')] },
    {
      code: withTools('Bash', inline('node_modules/.bin/eslint .')),
      filename: skill,
      errors: [relative('node_modules/.bin/eslint')],
    },
    // After another command, and only the first path of a command.
    {
      code: withTools('Bash', inline('cd src && ./run.sh')),
      filename: skill,
      errors: [relative('./run.sh')],
    },
    {
      code: withTools('Bash', inline('./a.sh && ./b.sh')),
      filename: skill,
      errors: [relative('./a.sh')],
    },
    // In the block form, in a command file and in a plugin skill.
    {
      code: withTools('Bash', block('echo start\n./run.sh')),
      filename: skill,
      errors: [relative('./run.sh')],
    },
    {
      code: withTools('Bash', inline('./run.sh')),
      filename: command,
      errors: [relative('./run.sh')],
    },
    {
      code: withTools('Bash', inline('./run.sh')),
      filename: pluginSkill(),
      errors: [relative('./run.sh')],
    },
    // A bad block hides the rules and not the path.
    {
      code: `---\nname: [unclosed\n---\n\n${inline('./run.sh')}\n`,
      filename: skill,
      errors: [relative('./run.sh')],
    },
    // No frontmatter at all.
    {
      code: inline('./run.sh'),
      filename: skill,
      errors: [unmatched('./run.sh', 1, 2), relative('./run.sh')],
    },
    // A check script with no fallback.
    {
      code: withTools('Bash', inline(`${skillDir}/check.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/check.sh`)],
    },
    {
      code: withTools('Bash', inline(`${skillDir}/lint-all.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/lint-all.sh`)],
    },
    {
      code: withTools('Bash', inline(`${skillDir}/scripts/verify_all.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/scripts/verify_all.sh`)],
    },
    {
      code: withTools('Bash', inline(`${skillDir}/Validate.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/Validate.sh`)],
    },
    {
      code: withTools('Bash', inline(`bash ${skillDir}/check.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/check.sh`)],
    },
    {
      code: withTools('Bash', inline(`python3 ${skillDir}/check.py --all`)),
      filename: skill,
      errors: [check(`${skillDir}/check.py`)],
    },
    {
      code: withTools('Bash', inline(`cd src && ${skillDir}/check.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/check.sh`)],
    },
    {
      code: withTools('Bash', block(`echo start\n${skillDir}/check.sh`)),
      filename: skill,
      errors: [check(`${skillDir}/check.sh`)],
    },
    {
      code: withTools('Bash', inline(`${pluginRoot}/check.sh`)),
      filename: pluginSkill(),
      errors: [check(`${pluginRoot}/check.sh`)],
    },
    {
      code: withTools('Bash', inline(`${skillDir}/check.sh`)),
      filename: command,
      errors: [check(`${skillDir}/check.sh`)],
    },
    // A relative check script gets both reports.
    {
      code: withTools('Bash', inline('./check.sh')),
      filename: skill,
      errors: [relative('./check.sh'), check('./check.sh')],
    },
    // A command that prints a placeholder.
    { code: withTools('Bash', block("echo '!`date`'")), filename: skill, errors: [nested] },
    {
      code: withTools('Bash', block('echo start\nprintf "%s" "!`id`"')),
      filename: skill,
      errors: [nested],
    },
    {
      code: withTools('Bash', `!${tick.repeat(2)} echo '!${tick}date${tick}' ${tick.repeat(2)}`),
      filename: skill,
      errors: [nested],
    },
    { code: withTools('Bash', block("echo '!`date`'")), filename: command, errors: [nested] },
  ],
})

describe('the messages', () => {
  const messages = (code: string) =>
    lintMarkdown('skill-inject-robustness', code, skill).map((m) => m.message)

  it('names the command that no rule allows', () => {
    expect(messages(inline('npm test'))).toEqual([
      'No `allowed-tools` Bash rule matches `npm test`. Outside auto mode, Claude Code aborts the skill invocation for a command that no rule allows. Add a `Bash(...)` rule to `allowed-tools`.',
    ])
  })

  it('names the relative path and the variables to use', () => {
    expect(messages(withTools('Bash', inline('./run.sh')))).toEqual([
      `\`./run.sh\` is a relative path. An injected command runs in the working directory of the session shell, which moves when Claude runs \`cd\`. Start the path with \`${skillDir}\` or \`${projectDir}\`.`,
    ])
  })

  it('names the check script', () => {
    expect(messages(withTools('Bash', inline(`${skillDir}/check.sh`)))).toEqual([
      `A non-zero exit code of \`${skillDir}/check.sh\` aborts the skill invocation. Add \`|| true\` to a check script that exits 1 when it finds problems.`,
    ])
  })

  it('names the nested placeholder', () => {
    expect(messages(withTools('Bash', block("echo '!`date`'")))).toEqual([
      'Claude Code does not scan the output of an injected command for another placeholder. A command cannot print `!`` for a later pass to expand.',
    ])
  })
})

// A plugin root that is a link out of the repository gives no report.
describe.skipIf(process.platform === 'win32')('a plugin root that the rule cannot see', () => {
  it('makes no report for a link out of the repository, and reports for a real root', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'skill-inject-robustness-'))
    try {
      mkdirSync(path.join(scratch, 'repo', '.git'), { recursive: true })
      mkdirSync(path.join(scratch, 'repo', 'real', '.claude-plugin'), { recursive: true })
      mkdirSync(path.join(scratch, 'outside', '.claude-plugin'), { recursive: true })
      writeFileSync(path.join(scratch, 'repo', 'real', '.claude-plugin', 'plugin.json'), '{}')
      writeFileSync(path.join(scratch, 'outside', '.claude-plugin', 'plugin.json'), '{}')
      symlinkSync('../outside', path.join(scratch, 'repo', 'plug'))
      const lint = (dir: string) =>
        lintMarkdown(
          'skill-inject-robustness',
          inline('npm test'),
          path.join(scratch, 'repo', dir, 'SKILL.md'),
        )
      expect(lint('plug')).toEqual([])
      expect(lint('real')).toHaveLength(1)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
