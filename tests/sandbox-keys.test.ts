// The types of `src/data/sandbox-keys.ts` and the keys of `src/data/settings-keys.ts` must stay
// the same set. The expected key count is the number of `sandbox.*` entries in the settings index
// of https://code.claude.com/docs/en/settings-reference#sandbox-settings: 12 keys of `sandbox`,
// 6 of `filesystem`, 11 of `network` and 5 of `credentials`, and the 3 objects.
import { describe, expect, it } from 'vitest'
import { ENV_NAME, SANDBOX_SHAPES, WITHHELD_BY } from '../src/data/sandbox-keys.ts'
import { AUTO_MODE_LISTS, hasListedChildren, listedChildren } from '../src/data/settings-keys.ts'

/** Every dotted key below `path` that the index lists, at any depth. */
function listed(path: readonly string[]): string[] {
  return listedChildren(path).flatMap((key) => {
    const child = [...path, key]
    return [child.join('.'), ...(hasListedChildren(child) ? listed(child) : [])]
  })
}

describe('sandbox-keys', () => {
  it('has one type for each key that the index lists below sandbox, and no other', () => {
    expect(Object.keys(SANDBOX_SHAPES).sort()).toEqual(listed(['sandbox']).sort())
  })

  it('counts the keys of the docs', () => {
    expect(listedChildren(['sandbox'])).toHaveLength(15)
    expect(listedChildren(['sandbox', 'filesystem'])).toHaveLength(6)
    expect(listedChildren(['sandbox', 'network'])).toHaveLength(11)
    expect(listedChildren(['sandbox', 'credentials'])).toHaveLength(5)
  })

  it('names a list that exists for each list that a managed file withholds', () => {
    for (const [list, withheld] of Object.entries(WITHHELD_BY)) {
      expect(Object.keys(SANDBOX_SHAPES), list).toContain(list)
      for (const key of withheld) {
        expect(Object.keys(SANDBOX_SHAPES), key).toContain(key)
      }
    }
  })

  it('reads a variable name as the docs describe it', () => {
    for (const name of ['A', '_a', 'NPM_TOKEN', 'a1_B']) {
      expect(ENV_NAME.test(name), name).toBe(true)
    }
    for (const name of ['', '1A', 'A-B', 'A B']) {
      expect(ENV_NAME.test(name), name).toBe(false)
    }
  })
})

describe('listedChildren', () => {
  it('is empty for a key with no listed child, and for a key that is not listed', () => {
    expect(listedChildren(['sandbox', 'ripgrep'])).toEqual([])
    expect(listedChildren(['nope'])).toEqual([])
  })

  it('lists the top level of the index for the empty path', () => {
    expect(listedChildren([])).toContain('sandbox')
  })
})

describe('AUTO_MODE_LISTS', () => {
  it('holds the four arrays of the autoMode entry', () => {
    expect(AUTO_MODE_LISTS).toEqual(['environment', 'allow', 'soft_deny', 'hard_deny'])
  })
})
