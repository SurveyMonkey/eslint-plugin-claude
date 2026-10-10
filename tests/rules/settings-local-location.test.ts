// Red first: the rule does not exist yet, so each case is expected to fail.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const ids = (root: string, file: string) =>
  lintJson('settings-local-location', '{}', path.join(root, file)).map((m) => m.messageId)

describe('settings-local-location (red)', () => {
  it.fails('reports a local file below the repository root', () => {
    expect(ids(repo({}), 'pkg/.claude/settings.local.json')).toEqual(['leftover'])
  })
})
