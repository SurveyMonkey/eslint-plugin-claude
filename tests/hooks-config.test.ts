// `quotedList` formats the names in a report. The reader itself is tested through the rules that
// use it, and the lists below stand for the messages of the rules.
import { expect, it } from 'vitest'
import { quotedList } from '../src/hooks-config.ts'

it('quotes one name', () => {
  expect(quotedList(['command'])).toBe('"command"')
})

it('joins two names with and', () => {
  expect(quotedList(['bash', 'powershell'])).toBe('"bash" and "powershell"')
})

it('joins three names with commas and a last and', () => {
  expect(quotedList(['command', 'http', 'mcp_tool'])).toBe('"command", "http" and "mcp_tool"')
})

it('gives an empty string for no name', () => {
  expect(quotedList([])).toBe('')
})
