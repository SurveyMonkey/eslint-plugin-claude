// The lists are literal copies of the plugin source table and the marketplace source table of
// the marketplace reference.
import { describe, expect, it } from 'vitest'
import {
  MARKETPLACE_SOURCE_TYPES,
  PLUGIN_SOURCE_TYPES,
  UNLOADED_MARKETPLACE_SOURCE_TYPES,
} from '../src/data/marketplace-source-types.ts'

describe('marketplace plugin source types', () => {
  it('holds the six object source types, each once', () => {
    expect(Object.values(PLUGIN_SOURCE_TYPES)).toEqual([
      'github',
      'url',
      'git-subdir',
      'npm',
      'archive',
      'command',
    ])
  })
})

// The marketplace source table lists ten types. Six load in `extraKnownMarketplaces`.
describe('marketplace source types', () => {
  it('holds the six types that extraKnownMarketplaces loads, each once', () => {
    expect(Object.values(MARKETPLACE_SOURCE_TYPES)).toEqual([
      'github',
      'git',
      'url',
      'file',
      'directory',
      'settings',
    ])
  })

  it('holds the four types that it does not load, each once', () => {
    expect(Object.values(UNLOADED_MARKETPLACE_SOURCE_TYPES)).toEqual([
      'npm',
      'skills-dir',
      'hostPattern',
      'pathPattern',
    ])
  })
})
