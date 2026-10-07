// The list is a literal copy of the plugin source table of the marketplace
// reference. The `command` constant must be one of its entries.
import { describe, expect, it } from 'vitest'
import { COMMAND_SOURCE_TYPE, PLUGIN_SOURCE_TYPES } from '../src/data/marketplace-source-types.ts'

describe('marketplace plugin source types', () => {
  it('holds the six object source types, each once', () => {
    expect(PLUGIN_SOURCE_TYPES).toEqual([
      'github',
      'url',
      'git-subdir',
      'npm',
      'archive',
      'command',
    ])
  })

  it('names the command type from the list', () => {
    expect(PLUGIN_SOURCE_TYPES).toContain(COMMAND_SOURCE_TYPE)
  })
})
