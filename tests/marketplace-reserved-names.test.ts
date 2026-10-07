// The lists are literal copies of the "Reserved names" block of the marketplace
// reference. The counts and the shapes catch a slip in a copy.
import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_MARKETPLACE_NAMES,
  CLAUDEAI_PREFIX,
  INTERNAL_MARKETPLACE_NAMES,
  PACKAGE_MANAGER_NAMES,
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

  it('holds the six package-manager names', () => {
    expect(PACKAGE_MANAGER_NAMES).toEqual(['npm', 'pip', 'uv', 'cargo', 'github', 'gh'])
  })

  it('writes each name in lowercase kebab case, and none in two lists', () => {
    const all = [
      ...ANTHROPIC_MARKETPLACE_NAMES,
      ...INTERNAL_MARKETPLACE_NAMES,
      ...PACKAGE_MANAGER_NAMES,
    ]
    expect(all.filter((name) => !/^[a-z]+(-[a-z]+)*$/.test(name))).toEqual([])
    expect(new Set(all).size).toBe(all.length)
  })

  it('sets the claude.ai prefix', () => {
    expect(CLAUDEAI_PREFIX).toBe('claudeai-')
  })
})
