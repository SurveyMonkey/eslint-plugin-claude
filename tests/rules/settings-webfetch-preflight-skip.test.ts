// Red first: the rule does not exist yet, so each case is expected to fail.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const SKIP = '{"skipWebFetchPreflight": true}'
const ids = (root: string, file = '.claude/settings.json') =>
  lintJson('settings-webfetch-preflight-skip', SKIP, path.join(root, file)).map((m) => m.messageId)

describe('settings-webfetch-preflight-skip (red)', () => {
  it.fails('reports a file with no WebFetch rule beside it', () => {
    expect(ids(repo({}))).toEqual(['skipped'])
  })
})
