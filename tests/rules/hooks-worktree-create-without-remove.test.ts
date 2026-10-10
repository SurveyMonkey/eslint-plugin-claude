// A WorktreeCreate hook creates the worktree. Without a WorktreeRemove hook, Claude Code removes only a
// worktree that git knows. A worktree of another version control system stays on disk
// (https://code.claude.com/docs/en/hooks#worktreeremove). The rule reads one file at a time.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import {
  command,
  FILES,
  frontmatter,
  hooks,
  jsonIds,
  markdownIds,
  SETTINGS,
  settings,
} from '../hooks.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-worktree-create-without-remove'
const create = { WorktreeCreate: [{ hooks: [command()] }] }
const remove = { WorktreeRemove: [{ hooks: [command()] }] }
const ids = (value: unknown, file = FILES.project) => jsonIds(name, settings(value), file)

describe(`${name}: the report`, () => {
  it('reports a WorktreeCreate hook with no WorktreeRemove hook in the file', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids(create, file), file).toEqual(['noRemove'])
    }
  })

  it('reports at the WorktreeCreate key, and says what Claude Code does without a remove hook', () => {
    const text =
      '{\n  "hooks": {\n    "WorktreeCreate": [{ "hooks": [{ "type": "command", "command": "./c.sh" }] }]\n  }\n}'
    const found = lintJson(name, text, FILES.project)
    expect(found.map(({ messageId, line, column }) => [messageId, line, column])).toEqual([
      ['noRemove', 3, 5],
    ])
    expect(found[0]?.message).toBe(
      'This file has a WorktreeCreate hook and no WorktreeRemove hook. Claude Code then removes only a worktree that git knows. Add a WorktreeRemove hook to clean up the worktree and its branch.',
    )
  })

  it('reports once for two WorktreeCreate handlers', () => {
    expect(
      ids({
        WorktreeCreate: [
          { hooks: [command(), command({ command: './d.sh' })] },
          create.WorktreeCreate[0],
        ],
      }),
    ).toEqual(['noRemove'])
  })

  it('reports when the WorktreeRemove event holds no handler', () => {
    expect(ids({ ...create, WorktreeRemove: [] })).toEqual(['noRemove'])
    expect(ids({ ...create, WorktreeRemove: [{ hooks: [] }] })).toEqual(['noRemove'])
  })

  it('reads the last of two events of one name', () => {
    expect(
      jsonIds(
        name,
        '{"hooks": {"WorktreeCreate": [], "WorktreeCreate": [{"hooks": [{"type": "command", "command": "c"}]}]}}',
        FILES.project,
      ),
    ).toEqual(['noRemove'])
  })

  it('reports in the frontmatter of a skill and of a project subagent', () => {
    const yaml = frontmatter(
      'WorktreeCreate:\n  - hooks:\n      - type: command\n        command: ./c.sh\n',
    )
    expect(markdownIds(name, yaml, FILES.skill)).toEqual(['noRemove'])
    expect(markdownIds(name, yaml, FILES.agent)).toEqual(['noRemove'])
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when the same file has a WorktreeRemove hook', () => {
    for (const file of [...SETTINGS, FILES.plugin]) {
      expect(ids({ ...create, ...remove }, file), file).toEqual([])
    }
    const yaml = frontmatter(
      'WorktreeCreate:\n  - hooks:\n      - type: command\n        command: ./c.sh\nWorktreeRemove:\n  - hooks:\n      - type: command\n        command: ./r.sh\n',
    )
    expect(markdownIds(name, yaml, FILES.skill)).toEqual([])
  })

  it('is silent with no WorktreeCreate handler, or with other events only', () => {
    expect(ids(hooks('Stop', [command()]))).toEqual([])
    expect(ids({ WorktreeCreate: [] })).toEqual([])
    expect(ids({ WorktreeCreate: [{ hooks: [] }] })).toEqual([])
    expect(ids(remove)).toEqual([])
    expect(jsonIds(name, '{}', FILES.project)).toEqual([])
    expect(jsonIds(name, '{"hooks": 1}', FILES.project)).toEqual([])
  })

  it('is silent for a hidden drop-in, a hooks.json that Claude Code does not read, and a plugin agent', () => {
    expect(ids(create, FILES.hidden)).toEqual([])
    expect(ids(create, '/repo/.claude/hooks.json')).toEqual([])
    const yaml = frontmatter(
      'WorktreeCreate:\n  - hooks:\n      - type: command\n        command: ./c.sh\n',
    )
    expect(markdownIds(name, yaml, '/repo/plugins/p/agents/a.md')).toEqual([])
    expect(markdownIds(name, yaml, '/repo/notes.md')).toEqual([])
  })
})

describe(`${name}: one file at a time`, () => {
  it('reports a create hook whose remove hook is in another settings file on disk', () => {
    const text = settings(create)
    const root = repo({
      '.claude/settings.json': text,
      '.claude/settings.local.json': settings(remove),
    })
    const found = lintJson(name, text, path.join(root, '.claude/settings.json'))
    expect(found.map((message) => message.messageId)).toEqual(['noRemove'])
  })

  it('is silent for the remove file, which holds no create hook', () => {
    expect(ids(remove, FILES.local)).toEqual([])
  })
})
