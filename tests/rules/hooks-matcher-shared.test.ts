// Behaviour that the six hooks matcher rules share: a repeated key reads as the last one, as
// `JSON.parse` reads it, and no rule takes an option.
import { describe, expect, it } from 'vitest'
import { FILES, jsonIds, settings } from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const RULES = [
  'hooks-if-condition',
  'hooks-matcher-enum',
  'hooks-matcher-mcp-name',
  'hooks-matcher-never-matches',
  'hooks-matcher-syntax',
  'hooks-matcher-unsupported-event',
] as const

const run = (rule: string, json: string) => jsonIds(rule, json, FILES.project)

describe('the hooks matcher rules: a repeated key', () => {
  it('reads the last matcher of a group', () => {
    const handler = '{"type":"command","command":"./a.sh"}'
    const wrongThenRight = `{"hooks":{"PreToolUse":[{"matcher":"(x","matcher":"Bash","hooks":[${handler}]}]}}`
    const rightThenWrong = `{"hooks":{"PreToolUse":[{"matcher":"Bash","matcher":"(x","hooks":[${handler}]}]}}`
    expect(run('hooks-matcher-syntax', wrongThenRight)).toEqual([])
    expect(run('hooks-matcher-syntax', rightThenWrong)).toEqual(['invalid'])
  })

  it('reads the last matcher for an event without matcher support', () => {
    const handler = '{"type":"command","command":"./a.sh"}'
    const json = `{"hooks":{"Stop":[{"matcher":"a","matcher":"","hooks":[${handler}]}]}}`
    expect(run('hooks-matcher-unsupported-event', json)).toEqual([])
  })

  it('reads the last if of a handler', () => {
    const handler = '{"type":"command","command":"./a.sh","if":"Bash(","if":"Bash"}'
    const json = `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[${handler}]}]}}`
    expect(run('hooks-if-condition', json)).toEqual([])
  })

  it('reads the last hooks array of a group', () => {
    const bad = '{"type":"command","command":"./a.sh","if":"Bash("}'
    const json = `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[${bad}],"hooks":[]}]}}`
    expect(run('hooks-if-condition', json)).toEqual([])
  })

  it('reads the last list of an event', () => {
    const json = '{"hooks":{"PreToolUse":[{"matcher":"(x"}],"PreToolUse":[]}}'
    expect(run('hooks-matcher-syntax', json)).toEqual([])
  })
})

describe('the hooks matcher rules: options', () => {
  it.each(RULES)('%s takes no option', (rule) => {
    expect(() => lintJson(rule, settings({}), FILES.project, [{}])).toThrow()
  })
})
