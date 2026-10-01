// The configs choose files by glob. RuleTester cannot see a glob that
// matches nothing, so this test runs ESLint itself over a tree built in a
// temporary directory. The tree is not committed, so neither the lint of
// this repository nor Claude Code reads it as configuration.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ESLint, type Linter } from 'eslint'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const long = 'a'.repeat(1537)
// The plugin variables, escaped so that the template literal keeps them as text.
const pluginRoot = `\${CLAUDE_PLUGIN_ROOT}`
const pluginData = `\${CLAUDE_PLUGIN_DATA}`
const badHooks = JSON.stringify({ hooks: { preToolUse: [] } })

const TREE: Record<string, string> = {
  'plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'p', hooks: { Bogus: [] } }),
  'plugins/p/skills/s/SKILL.md': `---\nname: s\ndescription: ${long}\n---\n`,
  'plugins/p/commands/c.md': '# C\n',
  'plugins/p/hooks/hooks.json': badHooks,
  '.claude/skills/t/SKILL.md': `---\nname: t\ndescription: ${long}\n---\n`,
  '.claude/commands/c.md': '# C\n',
  '.claude/commands/ns/c.md': '# C\n',
  '.claude/settings.json': badHooks,
  '.claude/settings.local.json': badHooks,
  'packages/x/.claude/settings.json': badHooks,
  'packages/x/.claude/settings.local.json': badHooks,
  // One bad file for each skill rule, and the same fault where the rule is silent.
  '.claude/skills/position/SKILL.md': '\n---\nname: position\n---\n',
  '.claude/skills/schema/SKILL.md': '---\nmade_up: 1\n---\n',
  '.claude/skills/fork/SKILL.md': '---\nagent: Plan\n---\n',
  '.claude/skills/unreachable/SKILL.md':
    '---\ndisable-model-invocation: true\nuser-invocable: false\n---\n',
  '.claude/skills/synced/SKILL.md': '# Synced\n',
  '.claude/skills/vars/SKILL.md': `Run ${pluginRoot}/run.sh\n`,
  '.claude/skills/bang/SKILL.md': 'KEY=!`cmd`\n',
  '.claude/skills/tools/SKILL.md': '---\nallowed-tools: AskUserQuestion\n---\n',
  '.claude/commands/schema.md': '---\nname: schema\n---\n',
  'plugins/p/skills/synced/SKILL.md': '# Synced\n',
  'plugins/p/skills/vars/SKILL.md': `Run ${pluginRoot}/run.sh\n`,
  'plugins/p/SKILL.md': `---\nname: p\n---\n\nRun ${pluginData}\n`,
  'plugins/q/.claude-plugin/plugin.json': JSON.stringify({ name: 'q' }),
  'plugins/q/SKILL.md': '# Q\n',
  // The same content in files that no rule reads, so no report.
  'docs/commands/c.md': '# Not a command\n',
  'docs/readme.md': '# Other Markdown\n',
  'docs/SKILL.md': `\n---\nmade_up: 1\nagent: Plan\nallowed-tools: AskUserQuestion\n---\nKEY=!\`cmd\` ${pluginRoot}\n`,
  '.claude/agents/a.md': `---\nname: a\ndescription: ${long}\n---\n`,
  'other.json': badHooks,
  'hooks.json': badHooks,
  '.vscode/settings.json': badHooks,
  '.vscode/settings.local.json': badHooks,
}

// Each file with a report, as `file: rule@severity`. 1 is warn, 2 is error.
const EXPECTED = [
  '.claude/commands/c.md: claude/command-legacy-format@1',
  '.claude/commands/ns/c.md: claude/command-legacy-format@1',
  '.claude/commands/schema.md: claude/command-legacy-format@1',
  '.claude/commands/schema.md: claude/skill-frontmatter-schema@2',
  '.claude/settings.json: claude/hooks-event-name-known@2',
  '.claude/settings.local.json: claude/hooks-event-name-known@2',
  '.claude/skills/bang/SKILL.md: claude/skill-inject-bang-position@2',
  '.claude/skills/fork/SKILL.md: claude/skill-fork-fields-require-context@2',
  '.claude/skills/position/SKILL.md: claude/skill-frontmatter-position@2',
  '.claude/skills/schema/SKILL.md: claude/skill-frontmatter-schema@2',
  '.claude/skills/synced/SKILL.md: claude/skill-reserved-name@2',
  '.claude/skills/t/SKILL.md: claude/skill-description-max-length@1',
  '.claude/skills/tools/SKILL.md: claude/skill-allowed-tools-ineffective@2',
  '.claude/skills/unreachable/SKILL.md: claude/skill-invocation-unreachable@2',
  '.claude/skills/vars/SKILL.md: claude/skill-plugin-vars-outside-plugin@2',
  'packages/x/.claude/settings.json: claude/hooks-event-name-known@2',
  'packages/x/.claude/settings.local.json: claude/hooks-event-name-known@2',
  'plugins/p/.claude-plugin/plugin.json: claude/hooks-event-name-known@2',
  'plugins/p/SKILL.md: claude/skill-plugin-root-shadowed@2',
  'plugins/p/commands/c.md: claude/command-legacy-format@1',
  'plugins/p/hooks/hooks.json: claude/hooks-event-name-known@2',
  'plugins/p/skills/s/SKILL.md: claude/skill-description-max-length@1',
]

// The skill rules of #8, in the order of the `modules` list. Each is an error.
const NEW_RULES = [
  'skill-frontmatter-position',
  'skill-frontmatter-schema',
  'skill-fork-fields-require-context',
  'skill-invocation-unreachable',
  'skill-reserved-name',
  'skill-plugin-vars-outside-plugin',
  'skill-inject-bang-position',
  'skill-allowed-tools-ineffective',
  'skill-plugin-root-shadowed',
]

let root = ''

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'eslint-plugin-claude-'))
  for (const [file, content] of Object.entries(TREE)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

/** Each report over the tree, as `file: rule@severity`, sorted. */
async function reports(config: Linter.Config[]): Promise<string[]> {
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: config })
  const results = await eslint.lintFiles(['.'])
  return results
    .flatMap((r) =>
      r.messages.map(
        (m) =>
          `${path.relative(root, r.filePath).split(path.sep).join('/')}: ${m.ruleId}@${m.severity}`,
      ),
    )
    .sort()
}

describe('configs', () => {
  it('names one block for each rule in recommended, at its severity', () => {
    expect(plugin.configs.recommended.map((c) => [c.name, c.rules])).toEqual([
      [
        'claude/recommended/skill-description-max-length',
        { 'claude/skill-description-max-length': 'warn' },
      ],
      ['claude/recommended/command-legacy-format', { 'claude/command-legacy-format': 'warn' }],
      ['claude/recommended/hooks-event-name-known', { 'claude/hooks-event-name-known': 'error' }],
      ...NEW_RULES.map((rule) => [`claude/recommended/${rule}`, { [`claude/${rule}`]: 'error' }]),
    ])
  })

  // No rule is off in recommended yet, so strict holds the same rules.
  it('gives strict the same rules and severities as recommended today', () => {
    const rulesOf = (config: Linter.Config[]) => config.map((c) => c.rules)
    expect(rulesOf(plugin.configs.strict)).toEqual(rulesOf(plugin.configs.recommended))
    expect(plugin.configs.strict.map((c) => c.name)).toEqual([
      'claude/strict/skill-description-max-length',
      'claude/strict/command-legacy-format',
      'claude/strict/hooks-event-name-known',
      ...NEW_RULES.map((rule) => `claude/strict/${rule}`),
    ])
  })

  it('recommended reports each rule on its own files, at its own severity', async () => {
    expect(await reports(plugin.configs.recommended)).toEqual(EXPECTED)
  })

  it('strict reports the same files as recommended today', async () => {
    expect(await reports(plugin.configs.strict)).toEqual(EXPECTED)
  })
})
