// The Boolean forms that the skills page accepts. This test pins the result
// of `readBoolean`, which `skill-invocation-unreachable` read before it moved.
import { describe, expect, it } from 'vitest'
import { readBoolean } from '../src/frontmatter-boolean.ts'

describe('readBoolean', () => {
  it.each([true, 'true', 'True', 'TRUE', 'yes', 'YES', 'on', 'On', '1', 1])(
    'reads %j as true',
    (value) => {
      expect(readBoolean(value)).toBe(true)
    },
  )

  it.each([false, 'false', 'False', 'no', 'NO', 'off', 'Off', '0', 0])(
    'reads %j as false',
    (value) => {
      expect(readBoolean(value)).toBe(false)
    },
  )

  it.each(['maybe', '', 'tru', 2, -1, 1.5])('gives null for the scalar %j', (value) => {
    expect(readBoolean(value)).toBeNull()
  })

  it.each([null, undefined, [], ['true'], {}, { a: 1 }])('gives null for %j', (value) => {
    expect(readBoolean(value)).toBeNull()
  })
})
