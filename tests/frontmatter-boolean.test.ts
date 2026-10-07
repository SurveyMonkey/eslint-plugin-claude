// The Boolean forms that the skills page accepts. `skill-invocation-unreachable`
// and `agent-skills-preloadable` share `readBoolean`.
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
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

// The rules call `readBoolean` with the parsed value. The source form is not seen. These cases
// pin what a rule reads for a frontmatter line. A quoted `"yes"` and a number such as `0x1` read
// as `true`. The skills page does not say that Claude Code reads them so.
describe('readBoolean on a parsed frontmatter value', () => {
  const read = (source: string) =>
    readBoolean((parse(`field: ${source}`) as { field: unknown }).field)

  it.each(['1.0', '01', '0x1', '"yes"', '"true"', "'on'", '"1"'])('reads %s as true', (source) => {
    expect(read(source)).toBe(true)
  })

  it.each(['0.0', '00', '0x0', '"no"', '"false"'])('reads %s as false', (source) => {
    expect(read(source)).toBe(false)
  })

  it.each(['y', 'n', '2', '"y"', '0x2'])('gives null for %s', (source) => {
    expect(read(source)).toBeNull()
  })
})
