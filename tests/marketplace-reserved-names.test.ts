// The lists are literal copies of the "Reserved names" block of the marketplace
// reference. The counts and the shapes catch a slip in a copy.
import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_MARKETPLACE_NAMES,
  CLAUDEAI_PREFIX,
  INTERNAL_MARKETPLACE_NAMES,
  JAVASCRIPT_MEMBER_NAMES,
} from '../src/data/marketplace-reserved-names.ts'

describe('marketplace reserved names', () => {
  it('holds the 19 official, community and directory names, each once', () => {
    // The names are written out from the "Reserved names" block of the live docs.
    expect([...ANTHROPIC_MARKETPLACE_NAMES].sort()).toEqual(
      [
        'claude-code-marketplace',
        'claude-code-plugins',
        'claude-plugins-official',
        'anthropic-marketplace',
        'anthropic-plugins',
        'agent-skills',
        'anthropic-agent-skills',
        'life-sciences',
        'knowledge-work-plugins',
        'claude-for-legal',
        'claude-for-financial-services',
        'financial-services-plugins',
        'first-party-plugins',
        'claude-tag-plugins',
        'claude-community',
        'claude-plugins-community',
        'healthcare',
        'anthropic-plugin-directory',
        'claude-plugin-directory',
      ].sort(),
    )
    expect(ANTHROPIC_MARKETPLACE_NAMES).toHaveLength(19)
    expect(new Set(ANTHROPIC_MARKETPLACE_NAMES).size).toBe(19)
  })

  it('names the first, a community name and the last of the official names', () => {
    expect(ANTHROPIC_MARKETPLACE_NAMES).toContain('claude-code-marketplace')
    expect(ANTHROPIC_MARKETPLACE_NAMES).toContain('healthcare')
    expect(ANTHROPIC_MARKETPLACE_NAMES).toContain('claude-plugin-directory')
  })

  it('holds the five internal names', () => {
    expect(INTERNAL_MARKETPLACE_NAMES).toEqual([
      'inline',
      'builtin',
      'skills-dir',
      'synced',
      'claude-plugin-test',
    ])
  })

  it('holds the seven member names that every JavaScript object has', () => {
    // The "Member names that every JavaScript object has" bullet of "Reserved names".
    expect([...JAVASCRIPT_MEMBER_NAMES].sort()).toEqual(
      [
        'constructor',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
        'toString',
        'valueOf',
      ].sort(),
    )
  })

  it('holds no package-manager name, because the docs reserve none', () => {
    // "Reserved names" lists no package manager. A probe of `claude plugin
    // validate` accepted a marketplace named `npm` (docs/rules-inventory.md).
    const all = [
      ...ANTHROPIC_MARKETPLACE_NAMES,
      ...INTERNAL_MARKETPLACE_NAMES,
      ...JAVASCRIPT_MEMBER_NAMES,
    ]
    for (const name of ['npm', 'pip', 'uv', 'cargo', 'github', 'gh']) {
      expect(all).not.toContain(name)
    }
  })

  it('writes each kebab-case name in lowercase, and none in two lists', () => {
    const kebab = [...ANTHROPIC_MARKETPLACE_NAMES, ...INTERNAL_MARKETPLACE_NAMES]
    expect(kebab.filter((name) => !/^[a-z]+(-[a-z]+)*$/.test(name))).toEqual([])
    const all = [...kebab, ...JAVASCRIPT_MEMBER_NAMES]
    expect(new Set(all).size).toBe(all.length)
  })

  it('sets the claude.ai prefix', () => {
    expect(CLAUDEAI_PREFIX).toBe('claudeai-')
  })
})
