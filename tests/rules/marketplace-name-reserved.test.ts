// The rule reads the top-level `name` of `.claude-plugin/marketplace.json`.
// The tests run on `json/json` with that file name. The files glob and the
// decoy files are in tests/configs.test.ts.

import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_MARKETPLACE_NAMES,
  INTERNAL_MARKETPLACE_NAMES,
  PACKAGE_MANAGER_NAMES,
} from '../../src/data/marketplace-reserved-names.ts'
import plugin from '../../src/index.ts'
import { jsonTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('marketplace-name-reserved')
const filename = '.claude-plugin/marketplace.json'
const manifest = (marketplaceName: string) => JSON.stringify({ name: marketplaceName, plugins: [] })

jsonTester.run('marketplace-name-reserved (valid)', rule, {
  valid: [
    { code: manifest('acme-tools'), filename },
    { code: manifest('my.market_place-2'), filename },
    // A reserved name inside a longer name, or with a letter missing.
    { code: manifest('my-claude-code-plugins'), filename },
    { code: manifest('claude-code-plugin'), filename },
    // An underscore for a hyphen is not a spelling of a reserved name.
    { code: manifest('claude_code_plugins'), filename },
    // The docs give no case folding for the official names or the prefix.
    { code: manifest('Claude-Code-Plugins'), filename },
    { code: manifest('Claudeai-tools'), filename },
    { code: manifest('claudeai'), filename },
    { code: manifest('inline-tools'), filename },
    { code: manifest('npmx'), filename },
    { code: manifest('github-tools'), filename },
    // A value of the wrong type is for the schema rule.
    { code: JSON.stringify({ name: 3 }), filename },
    { code: JSON.stringify({ name: ['inline'] }), filename },
    { code: JSON.stringify({ plugins: [] }), filename },
    { code: '[]', filename },
    // Two `name` keys. The rule reads the last, as `JSON.parse` does.
    { code: '{"name": "inline", "name": "acme-tools"}', filename },
    // A plugin entry name is not the marketplace name.
    { code: JSON.stringify({ name: 'acme', plugins: [{ name: 'inline' }] }), filename },
    // `allowOfficial` silences the official, community and directory names.
    ...ANTHROPIC_MARKETPLACE_NAMES.map((marketplaceName) => ({
      code: manifest(marketplaceName),
      filename,
      options: [{ allowOfficial: true }],
    })),
  ],
  invalid: [],
})

jsonTester.run('marketplace-name-reserved (invalid)', rule, {
  valid: [],
  invalid: [
    ...ANTHROPIC_MARKETPLACE_NAMES.map((marketplaceName) => ({
      code: manifest(marketplaceName),
      filename,
      errors: [{ messageId: 'official' as const, data: { name: marketplaceName } }],
    })),
    {
      code: manifest('claude-plugins-official'),
      filename,
      options: [{ allowOfficial: false }],
      errors: [{ messageId: 'official', line: 1, column: 9 }],
    },
    ...INTERNAL_MARKETPLACE_NAMES.map((marketplaceName) => ({
      code: manifest(marketplaceName),
      filename,
      errors: [{ messageId: 'internal' as const, data: { name: marketplaceName } }],
    })),
    ...[...PACKAGE_MANAGER_NAMES, 'NPM', 'GitHub', 'Cargo'].map((marketplaceName) => ({
      code: manifest(marketplaceName),
      filename,
      errors: [{ messageId: 'packageManager' as const, data: { name: marketplaceName } }],
    })),
    ...['claudeai-tools', 'claudeai-'].map((marketplaceName) => ({
      code: manifest(marketplaceName),
      filename,
      errors: [{ messageId: 'claudeaiPrefix' as const, data: { name: marketplaceName } }],
    })),
    // A trailing dot, and a symbol other than an underscore for a hyphen.
    ...(
      [
        ['claude.code.plugins', 'claude-code-plugins'],
        ['claude-code-plugins.', 'claude-code-plugins'],
        ['claude+code+plugins', 'claude-code-plugins'],
        ['claude.code-plugins.', 'claude-code-plugins'],
        ['healthcare.', 'healthcare'],
        ['anthropic@plugin@directory', 'anthropic-plugin-directory'],
      ] as const
    ).map(([marketplaceName, reserved]) => ({
      code: manifest(marketplaceName),
      filename,
      errors: [{ messageId: 'spelling' as const, data: { name: marketplaceName, reserved } }],
    })),
    // `allowOfficial` does not silence a spelling, an internal name, a
    // package-manager name or the prefix.
    ...[
      ['claude.code.plugins', 'spelling'],
      ['inline', 'internal'],
      ['npm', 'packageManager'],
      ['claudeai-x', 'claudeaiPrefix'],
    ].map(([marketplaceName, messageId]) => ({
      code: manifest(marketplaceName as string),
      filename,
      options: [{ allowOfficial: true }],
      errors: [{ messageId: messageId as 'spelling' }],
    })),
    // Two `name` keys. `JSON.parse` keeps the last, so the rule reads it.
    {
      code: '{"name": "acme-tools", "name": "inline"}',
      filename,
      errors: [{ messageId: 'internal', line: 1, column: 32 }],
    },
  ],
})

describe('marketplace-name-reserved options', () => {
  const lint = (options: unknown[]) =>
    new Linter({ cwd: '/' }).verify(
      manifest('claude-code-plugins'),
      [
        {
          files: ['**/*.json'],
          plugins: { json, markdown, claude: plugin },
          language: 'json/json',
          rules: { 'claude/marketplace-name-reserved': ['error', ...options] as never },
        },
      ],
      { filename: '/repo/.claude-plugin/marketplace.json' },
    )

  it('reports an official name when the option is not set', () => {
    expect(lint([]).map((m) => m.messageId)).toEqual(['official'])
  })

  it('keeps the default when the option object is empty', () => {
    expect(lint([{}]).map((m) => m.messageId)).toEqual(['official'])
  })

  it('accepts an official name when allowOfficial is true', () => {
    expect(lint([{ allowOfficial: true }])).toEqual([])
  })

  it.each([
    ['a string', { allowOfficial: 'yes' }],
    ['a number', { allowOfficial: 1 }],
    ['an unknown key', { allowOfficial: true, extra: 1 }],
  ])('refuses %s as the option', (_, option) => {
    expect(() => lint([option])).toThrow(/Key "claude\/marketplace-name-reserved"/)
  })
})
