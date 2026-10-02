// A rule that does not parse gets one report from the 7 grammar rules, from
// `permissions-rule-syntax` alone (round 3 ruling 8). The other 6 skip it.
import json from '@eslint/json'
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
