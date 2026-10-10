// Red first: the rule does not exist yet, so the case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

describe('mcp-json-file-size (red)', () => {
  it.fails('reports a file of one byte over 2 MiB', () => {
    const code = `{"a":"${'x'.repeat(2097152 + 1 - 8)}"}`
    expect(lintJson('mcp-json-file-size', code, '.mcp.json').map((m) => m.messageId)).toEqual([
      'tooLarge',
    ])
  })
})
