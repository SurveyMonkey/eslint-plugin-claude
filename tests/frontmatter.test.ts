import { describe, expect, it } from 'vitest'
import { frontmatterFields, parseFrontmatter, stringField } from '../src/frontmatter.ts'

describe('parseFrontmatter', () => {
  it('reads a mapping, folded scalars included', () => {
    expect(parseFrontmatter('name: a\ndescription: >-\n  one\n  two\n')).toEqual({
      name: 'a',
      description: 'one two',
    })
  })

  it('gives null for YAML that does not parse', () => {
    expect(parseFrontmatter('description: [unclosed')).toBeNull()
  })

  it('gives null when the top level is not a mapping', () => {
    expect(parseFrontmatter('')).toBeNull()
    expect(parseFrontmatter('just text')).toBeNull()
    expect(parseFrontmatter('- a\n- b')).toBeNull()
  })
})

describe('stringField', () => {
  it('gives the value of a string field, and the empty string for any other', () => {
    const data = { description: 'x', count: 3 }
    expect(stringField(data, 'description')).toBe('x')
    expect(stringField(data, 'count')).toBe('')
    expect(stringField(data, 'absent')).toBe('')
  })
})

describe('frontmatterFields', () => {
  it('gives the offsets of each key and value', () => {
    const text = 'name: a\nallowed-tools: Read Grep\n'
    expect(frontmatterFields(text)).toEqual([
      { key: 'name', keyStart: 0, keyEnd: 4, valueStart: 6, valueEnd: 7 },
      { key: 'allowed-tools', keyStart: 8, keyEnd: 21, valueStart: 23, valueEnd: 32 },
    ])
  })

  it('gives an empty value range for a key with no value', () => {
    for (const text of ['paths:\n', '? paths\n']) {
      const [field] = frontmatterFields(text)
      expect(field?.key).toBe('paths')
      expect(field?.valueStart).toBe(field?.valueEnd)
    }
    // With no value node, the range falls back to the end of the key.
    const [explicit] = frontmatterFields('? paths\n')
    expect(explicit?.valueStart).toBe(explicit?.keyEnd)
  })

  it('leaves out a key that is not a string', () => {
    expect(frontmatterFields('1: a\n? [x]\n: b\nname: c\n').map((f) => f.key)).toEqual(['name'])
  })

  it('gives no field when the top level is not a mapping', () => {
    expect(frontmatterFields('just text')).toEqual([])
  })
})
