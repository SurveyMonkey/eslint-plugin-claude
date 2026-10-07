// The list is a literal copy of the plugin source table of the marketplace
// reference.
import { describe, expect, it } from 'vitest'
import { PLUGIN_SOURCE_TYPES } from '../src/data/marketplace-source-types.ts'

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
