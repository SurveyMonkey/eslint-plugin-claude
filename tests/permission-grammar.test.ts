// A rule that does not parse gets one report from the 7 grammar rules, from
// `permissions-rule-syntax` alone. The other 6 skip it. A settings file and a
// skill file share this contract.
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const GRAMMAR_RULES = [
  'permissions-rule-syntax',
  'permissions-unknown-tool',
  'permissions-tool-name-glob',
  'permissions-specifier-unsupported',
  'permissions-path-rule-tool',
  'permissions-mcp-rule-parens',
  'permissions-param-rule',
]

/** The rule IDs of each report that the 7 rules make on `permissions`. */
function lint(permissions: unknown): string[] {
  const config: Linter.Config = {
    files: ['**/.claude/settings.json'],
    plugins: { json, claude: plugin },
    language: 'json/json',
    rules: Object.fromEntries(GRAMMAR_RULES.map((rule) => [`claude/${rule}`, 'error'])),
  }
  return new Linter()
    .verify(JSON.stringify({ permissions }), [config], { filename: '.claude/settings.json' })
    .map((message) => message.ruleId as string)
}

describe('the grammar rules together', () => {
  // Each string would break a second rule if it parsed as a name and a specifier.
  it.each([
    'mcp__a(x',
    'WebSearch(x',
    'Write(x',
    'Bash(command:x',
    'bogus(x',
    '*(x',
    '(x)',
    'mcp__a(x) y',
    'WebSearch(x) y',
    'Write(x) y\u0000',
  ])('reports the malformed rule %j once, from permissions-rule-syntax', (rule) => {
    expect(lint({ allow: [rule], deny: [rule] })).toEqual([
      'claude/permissions-rule-syntax',
      'claude/permissions-rule-syntax',
    ])
  })

  it('reports a rule that parses from each rule that it breaks', () => {
    expect(lint({ allow: ['mcp__a(x)'], deny: ['Bash(command:x)'] }).sort()).toEqual([
      'claude/permissions-mcp-rule-parens',
      'claude/permissions-param-rule',
    ])
  })

  it('reports nothing for the valid forms of the docs', () => {
    expect(
      lint({
        allow: ['Bash(npm run *)', 'mcp__puppeteer__*', 'Edit(/src/**)', 'WebSearch'],
        ask: ['Agent(model:opus)'],
        deny: ['*', 'Read(./.env)'],
      }),
    ).toEqual([])
  })
})

/** The rule IDs of each report that the 7 rules make on the file `filename`,
 *  which holds the frontmatter `fields`. */
function lintFrontmatter(fields: string, filename: string): string[] {
  const config: Linter.Config = {
    files: ['**/*.md'],
    plugins: { markdown, claude: plugin },
    language: 'markdown/gfm',
    languageOptions: { frontmatter: 'yaml' },
    rules: Object.fromEntries(GRAMMAR_RULES.map((rule) => [`claude/${rule}`, 'error'])),
  }
  return new Linter()
    .verify(`---\n${fields}---\n\n# S\n`, [config], { filename })
    .map((message) => message.ruleId as string)
}

const SKILL = '.claude/skills/s/SKILL.md'

describe('the grammar rules together, in skill frontmatter', () => {
  // A JSON string is a YAML double-quoted string, so it holds the rule as written.
  // These strings do not split into two rules.
  it.each([
    'mcp__a(x',
    'WebSearch(x',
    'Write(x',
    'Bash(command:x',
    'bogus(x',
    '*(x',
    '(x)',
    'mcp__a(x)y',
    'WebSearch(x)y',
    'Write(x)y\u0000',
  ])('reports the malformed rule %j once, from permissions-rule-syntax', (rule) => {
    const field = JSON.stringify(rule)
    expect(
      lintFrontmatter(`allowed-tools: ${field}\ndisallowed-tools: [${field}]\n`, SKILL),
    ).toEqual(['claude/permissions-rule-syntax', 'claude/permissions-rule-syntax'])
  })

  it('reports a rule that parses from each rule that it breaks', () => {
    const fields = 'allowed-tools: mcp__a(x)\ndisallowed-tools:\n  - Bash(command:x)\n'
    expect(lintFrontmatter(fields, SKILL).sort()).toEqual([
      'claude/permissions-mcp-rule-parens',
      'claude/permissions-param-rule',
    ])
    expect(lintFrontmatter(fields, '.claude/commands/c.md').sort()).toEqual([
      'claude/permissions-mcp-rule-parens',
      'claude/permissions-param-rule',
    ])
  })

  it('reads the string form and the YAML list form alike', () => {
    expect(lintFrontmatter('allowed-tools: Write(x) Bogus\n', SKILL).sort()).toEqual([
      'claude/permissions-path-rule-tool',
      'claude/permissions-unknown-tool',
    ])
    expect(lintFrontmatter('allowed-tools: [Write(x), Bogus]\n', SKILL).sort()).toEqual([
      'claude/permissions-path-rule-tool',
      'claude/permissions-unknown-tool',
    ])
  })

  it('reports nothing for the valid forms of the docs', () => {
    expect(
      lintFrontmatter(
        'allowed-tools: Bash(git add *) Bash(git commit *), mcp__puppeteer__*, WebSearch\n' +
          'disallowed-tools: [AskUserQuestion, Agent(model:opus), "*"]\n',
        SKILL,
      ),
    ).toEqual([])
  })

  // The sub-agents page: `tools` takes `Agent(type)` and `disallowedTools` takes a
  // specifier that removes the whole tool. `agent-tools-known` owns both fields.
  it('reports nothing in a subagent file', () => {
    expect(
      lintFrontmatter(
        'name: a\ndescription: d\ntools: Agent(worker), Bogus(x, mcp__*\ndisallowedTools: Bash(git push *), Write(x)\n',
        '.claude/agents/a.md',
      ),
    ).toEqual([])
  })

  it('reports nothing in a Markdown file that is no skill', () => {
    expect(lintFrontmatter('allowed-tools: Bogus(x\n', 'docs/SKILL.md')).toEqual([])
  })
})
