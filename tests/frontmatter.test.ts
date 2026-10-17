import { describe, expect, it } from 'vitest'
import {
  classifyFrontmatter,
  frontmatterFields,
  parseFrontmatter,
  stringField,
} from '../src/frontmatter.ts'

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

describe('classifyFrontmatter', () => {
  it('gives the fields of a mapping', () => {
    expect(classifyFrontmatter('name: a\ndescription: d\n')).toEqual({
      kind: 'mapping',
      data: { name: 'a', description: 'd' },
    })
  })

  it('gives the value of YAML that parses to a list or a scalar', () => {
    expect(classifyFrontmatter('- a\n- b\n')).toEqual({ kind: 'not-mapping', value: ['a', 'b'] })
    expect(classifyFrontmatter('just text\n')).toEqual({ kind: 'not-mapping', value: 'just text' })
    // An empty block, a block of comments only, and a YAML null parse to null.
    expect(classifyFrontmatter('')).toEqual({ kind: 'not-mapping', value: null })
    expect(classifyFrontmatter('# note\n')).toEqual({ kind: 'not-mapping', value: null })
    expect(classifyFrontmatter('~\n')).toEqual({ kind: 'not-mapping', value: null })
    expect(classifyFrontmatter('false\n')).toEqual({ kind: 'not-mapping', value: false })
  })

  it('gives the first error and its line for YAML that does not parse', () => {
    // A plain scalar with `: ` in it, as in issue #288.
    expect(classifyFrontmatter('name: a\ndescription: Use this when x. Context: y\n')).toEqual({
      kind: 'error',
      message: 'Nested mappings are not allowed in compact mappings',
      line: 2,
    })
    expect(classifyFrontmatter('name: s\nargument-hint: [n] [n]\n')).toEqual({
      kind: 'error',
      message: 'Unexpected flow-seq-start at node end',
      line: 2,
    })
  })

  it('gives no line for an alias that the parser cannot resolve', () => {
    expect(classifyFrontmatter('a: *x\n')).toEqual({
      kind: 'error',
      message: 'Unresolved alias (the anchor must be set before the alias): x',
      line: null,
    })
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
