// Red first: the rule does not exist yet, so each case is expected to fail.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (file: string) =>
  lintJson('mcp-json-location', '{"mcpServers": {}}', file).map((m) => m.messageId)

describe('mcp-json-location (red)', () => {
  it.fails('reports .claude/.mcp.json', () => {
    expect(ids('.claude/.mcp.json')).toEqual(['unread'])
  })
  it.fails('reports .claude/mcp.json', () => {
    expect(ids('.claude/mcp.json')).toEqual(['unread'])
  })
  it.fails('reports .claude/config/mcp.json', () => {
    expect(ids('.claude/config/mcp.json')).toEqual(['unread'])
  })
})
