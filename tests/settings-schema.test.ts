// The value data of `settings-schema` against the key catalog. The catalog is the Scope column of
// the settings index (https://code.claude.com/docs/en/settings-reference#settings-index). The
// owners are the rules named in the header of `src/data/settings-schema.ts`.
import { describe, expect, it } from 'vitest'
import { hasListedChildren, NO_EFFECT_KEYS, settingsKeyScope } from '../src/data/settings-keys.ts'
import { NOT_UNKNOWN_KEYS, SETTINGS_VALUES } from '../src/data/settings-schema.ts'

describe('the value data of settings-schema', () => {
  const keys = Object.keys(SETTINGS_VALUES)

  it('holds only keys of the catalog', () => {
    expect(keys.filter((key) => !settingsKeyScope([key]) && !hasListedChildren([key]))).toEqual([])
  })

  it('holds no key that another rule owns', () => {
    const owned = ['permissions', 'sandbox', 'autoMode', 'disableAutoMode', 'env', 'hooks']
    expect(keys.filter((key) => owned.includes(key))).toEqual([])
    expect(keys.filter((key) => key in NO_EFFECT_KEYS)).toEqual([])
    expect(keys.filter((key) => settingsKeyScope([key])?.reportedBy !== undefined)).toEqual([])
    expect(keys.filter((key) => settingsKeyScope([key])?.scope === 'global')).toEqual([])
  })

  it('does not exempt a key of the catalog from the unknown key check', () => {
    expect(NOT_UNKNOWN_KEYS.filter((key) => settingsKeyScope([key]) !== undefined)).toEqual([])
  })
})
