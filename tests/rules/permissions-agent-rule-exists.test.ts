// An `Agent(Name)` rule matches the subagent with that name
// (https://code.claude.com/docs/en/permissions#agent-subagents). The rule reads the
// `.claude/agents/` folders of the project and above it, as `settings-agent-exists` does. The
// expected values come from the permissions page and the sub-agents page
// (https://code.claude.com/docs/en/sub-agents#disable-specific-subagents). The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const onLinks = noLinks ? it.skip : it
const onChmod = chmodCannotBlock ? it.skip : it
const name = 'permissions-agent-rule-exists'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const AGENTS = '.claude/agents'
const agent = (fields = 'name: reviewer') => `---\n${fields}\ndescription: d\n---\nReview.\n`
const settings = (...rules: string[]) => JSON.stringify({ permissions: { deny: rules } })

const ids = (dir: string, code: string, file = PROJECT) =>
  lintJson(name, code, path.join(dir, file)).map((message) => message.messageId)

/** The messages of the rule with the option `allow`. */
const withOption = (dir: string, code: string, allow: string[]) =>
  new Linter({ cwd: path.parse(dir).root })
    .verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: { [`claude/${name}`]: ['error', { allow }] },
        },
      ],
      { filename: path.join(dir, PROJECT) },
    )
    .map((message) => message.messageId)

describe(`${name}: reports`, () => {
  it('reports a name that no built-in or project agent has, in each list', () => {
    const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() })
    for (const list of ['allow', 'ask', 'deny']) {
      const code = JSON.stringify({ permissions: { [list]: ['Agent(Ghost)'] } })
      expect(ids(dir, code), list).toEqual(['unknown'])
      expect(ids(dir, code, LOCAL), list).toEqual(['unknown'])
    }
  })

  it('names the agent and the option, at the rule', () => {
    const [message] = lintJson(name, settings('Agent(Ghost)'), path.join(tree({}), PROJECT))
    expect(message).toMatchObject({ messageId: 'unknown', line: 1 })
    expect(message?.message).toContain('"Ghost"')
    expect(message?.message).toContain('"allow"')
  })

  it('reports an agent file with no name, or with a name that is not a string', () => {
    const dir = tree({
      [`${AGENTS}/ghost.md`]: '---\ndescription: d\n---\nBody\n',
      [`${AGENTS}/numbered.md`]: agent('name: 7'),
      [`${AGENTS}/bare.md`]: 'No frontmatter.\n',
    })
    expect(ids(dir, settings('Agent(ghost)', 'Agent(numbered)', 'Agent(bare)'))).toEqual([
      'unknown',
      'unknown',
      'unknown',
    ])
  })

  it('reports the agent of another project and an agent in a file that is not Markdown', () => {
    const dir = tree({
      [`${AGENTS}/notes.txt`]: agent('name: notes'),
      'packages/other/.claude/agents/theirs.md': agent('name: theirs'),
    })
    expect(ids(dir, settings('Agent(notes)', 'Agent(theirs)'))).toEqual(['unknown', 'unknown'])
  })

  it('reports an agent in a directory above the repository that holds the project', () => {
    const dir = tree({
      [`${AGENTS}/outer.md`]: agent('name: outer'),
      'packages/inner/.git/HEAD': '',
    })
    const file = 'packages/inner/.claude/settings.json'
    expect(ids(dir, settings('Agent(outer)'), file)).toEqual(['unknown'])
  })

  it('reports a rule whose specifier has outer white space around a missing name', () => {
    expect(ids(tree({}), settings('Agent( Ghost )'))).toEqual(['unknown'])
  })

  it('reports with the option allow set to other names', () => {
    expect(withOption(tree({}), settings('Agent(Ghost)'), ['other'])).toEqual(['unknown'])
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for each built-in agent, in any letter case', () => {
    const rules = [
      'Explore',
      'Plan',
      'general-purpose',
      'claude',
      'statusline-setup',
      'claude-code-guide',
      'explore',
    ].map((agentName) => `Agent(${agentName})`)
    expect(ids(tree({}), settings(...rules))).toEqual([])
  })

  it('stays silent for a project agent, by the name field of its frontmatter', () => {
    const dir = tree({
      [`${AGENTS}/file-name.md`]: agent('name: code-reviewer'),
      [`${AGENTS}/team/deep.md`]: agent('name: deep'),
    })
    expect(
      ids(dir, settings('Agent(code-reviewer)', 'Agent(Code-Reviewer)', 'Agent(deep)')),
    ).toEqual([])
  })

  it('stays silent for an agent in the agents folder of a directory above the project', () => {
    const dir = tree({ [`${AGENTS}/root.md`]: agent('name: root') })
    const file = 'packages/app/.claude/settings.json'
    expect(ids(dir, settings('Agent(root)'), file)).toEqual([])
  })

  it('stays silent for a plugin agent, a glob, a parameter rule and a bare name', () => {
    const rules = [
      'Agent(my-plugin:reviewer)',
      'Agent(*)',
      'Agent(rev*)',
      'Agent(rev?ewer)',
      'Agent([r]eviewer)',
      'Agent',
      'Agent()',
      'Agent(model:opus)',
      'Agent(isolation: worktree)',
      'Task(Ghost)',
      'Bash(Agent(Ghost))',
      'Agent(Ghost',
    ]
    expect(ids(tree({}), settings(...rules))).toEqual([])
  })

  it('stays silent for a name that the option allow lists, in any letter case', () => {
    expect(withOption(tree({}), settings('Agent(My-User-Agent)'), ['my-user-agent'])).toEqual([])
  })

  it('stays silent in a managed file, which is not for one project', () => {
    const dir = tree({})
    expect(ids(dir, settings('Agent(Ghost)'), 'managed-settings.json')).toEqual([])
    expect(ids(dir, settings('Agent(Ghost)'), 'managed-settings.d/10-a.json')).toEqual([])
  })

  it('stays silent for a file with no rules, or one that is not an object', () => {
    expect(ids(tree({}), '{}')).toEqual([])
    expect(ids(tree({}), '[1]')).toEqual([])
  })
})

describe(`${name}: a path that the rule cannot see`, () => {
  onLinks('stays silent for a link out of the repository in the agents folder', () => {
    const outside = tree({ 'x.md': agent('name: x') }, false)
    const dir = tree({})
    link(dir, AGENTS, outside)
    expect(ids(dir, settings('Agent(Ghost)'))).toEqual([])
  })

  onLinks('stays silent for a link with no target in place of the folder', () => {
    const dir = tree({})
    link(dir, AGENTS, 'missing-agents')
    expect(ids(dir, settings('Agent(Ghost)'))).toEqual([])
  })

  onLinks('stays silent for a link with no target in a folder above the project', () => {
    const dir = tree({ 'packages/app/.claude/settings.json': '{}' })
    link(dir, 'packages/.claude', 'missing-claude')
    expect(ids(dir, settings('Agent(Ghost)'), 'packages/app/.claude/settings.json')).toEqual([])
  })

  onChmod('stays silent for an agents folder that it cannot read', () => {
    const dir = tree({ [`${AGENTS}/reviewer.md`]: agent() })
    expect(ids(dir, settings('Agent(Ghost)'))).toEqual(['unknown'])
    withoutAccess(path.join(dir, AGENTS), () => {
      expect(ids(dir, settings('Agent(Ghost)'))).toEqual([])
    })
  })

  onChmod('stays silent for an agent file that it cannot read', () => {
    const dir = tree({ [`${AGENTS}/a.md`]: agent('name: a'), [`${AGENTS}/b.md`]: agent('name: b') })
    withoutAccess(path.join(dir, AGENTS, 'a.md'), () => {
      expect(ids(dir, settings('Agent(Ghost)'))).toEqual([])
    })
  })
})
