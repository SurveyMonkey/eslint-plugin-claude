// `scopeAgentFiles` lists the agent files of a scope. A rule gets a plugin scope from
// `classifyLinted`, which gives no scope for a manifest that does not say which files load. So
// this test calls the helper directly for that case.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scopeAgentFiles } from '../src/agent-project.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { agent, repo } from './agent-settings.test-support.ts'

describe('scopeAgentFiles', () => {
  it('gives UNREADABLE when the manifest does not say which files load', () => {
    for (const manifest of ['{', '{"agents":5}', '{"agents":["./custom/a.md",5]}']) {
      const root = repo({ '.claude-plugin/plugin.json': manifest, 'agents/a.md': agent('') })
      expect(scopeAgentFiles({ plugin: true, root }), manifest).toBe(UNREADABLE)
    }
  })

  it('gives the files below agents/ when the manifest has no agents key', () => {
    const root = repo({ '.claude-plugin/plugin.json': '{}', 'agents/a.md': agent('') })
    expect(scopeAgentFiles({ plugin: true, root })).toEqual([path.join(root, 'agents', 'a.md')])
  })
})
