// `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` work in plugin skills
// only. The plugin case needs a real manifest on disk.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-plugin-vars-'))
const plugin = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const skill = '.claude/skills/s/SKILL.md'
const command = '.claude/commands/c.md'
// Escaped, so that the template literal keeps each variable as text.
const root = `\${CLAUDE_PLUGIN_ROOT}`
const data = `\${CLAUDE_PLUGIN_DATA}`
const skillDir = `\${CLAUDE_SKILL_DIR}`
const projectDir = `\${CLAUDE_PROJECT_DIR}`

markdownTester.run('skill-plugin-vars-outside-plugin', ruleOf('skill-plugin-vars-outside-plugin'), {
  valid: [
    {
      code: `---\nname: s\nallowed-tools: Bash(${root}/run.sh)\n---\n\nRun ${root}/run.sh\n`,
      filename: path.join(plugin, 'skills', 's', 'SKILL.md'),
    },
    { code: `Run ${data}/cache\n`, filename: path.join(plugin, 'commands', 'c.md') },
    { code: `Run ${root}/run.sh\n`, filename: path.join(plugin, 'SKILL.md') },
    // The variables that work everywhere.
    {
      code: `---\nallowed-tools: Bash(${skillDir}/run.sh)\n---\n\nRun ${skillDir}/run.sh ${projectDir}\n`,
      filename: skill,
    },
    // The shell form, and a name that only looks like the variable.
    { code: `Run $CLAUDE_PLUGIN_ROOT/run.sh \${CLAUDE_PLUGIN_ROOT_X}\n`, filename: skill },
    { code: '---\nname: s\n---\n\n# S\n', filename: skill },
    { code: `Run ${root}\n`, filename: 'docs/SKILL.md' },
    { code: `---\nname: [unclosed\n---\n\nRun ${root}\n`, filename: skill },
  ],
  invalid: [
    {
      code: `---\nname: s\n---\n\nRun ${root}/run.sh\n`,
      filename: skill,
      errors: [
        { messageId: 'literal', data: { variable: root }, line: 5, column: 5, endColumn: 26 },
      ],
    },
    {
      code: `Run ${data}/cache\n`,
      filename: command,
      errors: [{ messageId: 'literal', data: { variable: data }, line: 1, column: 5 }],
    },
    {
      code: `---\nallowed-tools: Bash(${root}/run.sh *)\n---\n\n# S\n`,
      filename: skill,
      errors: [{ messageId: 'literal', data: { variable: root }, line: 2, column: 21 }],
    },
    // Each use is a report, in fenced code too.
    {
      code: `---\nallowed-tools: [Read]\n---\n\n${root} and ${data}\n\n\`\`\`sh\n${root}\n\`\`\`\n`,
      filename: skill,
      errors: [
        { messageId: 'literal', line: 5, column: 1 },
        { messageId: 'literal', line: 5, column: 27 },
        { messageId: 'literal', line: 8 },
      ],
    },
    {
      code: `Run ${root}\n`,
      filename: path.join(scratch, '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'literal' }],
    },
  ],
})
