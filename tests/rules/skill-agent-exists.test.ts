// The `agent` field of a skill or command file must name a built-in agent, an
// agent file the repository holds, or an agent of the plugin. The trees are on
// disk under tests/fixtures/skill-agent-exists/. The `.git` stop of the walk
// up needs a directory that git would not commit, so those trees are built at
// run time.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  chmodCannotBlock,
  lintMarkdown,
  markdownTester,
  ruleOf,
  withoutAccess,
} from '../rule-tester.test-support.ts'

const fixtures = path.join(import.meta.dirname, '../fixtures/skill-agent-exists')
const project = path.join(fixtures, 'project')
const projectSkill = path.join(project, '.claude', 'skills', 'research', 'SKILL.md')
const projectCommand = path.join(project, '.claude', 'commands', 'run.md')
const nestedSkill = path.join(project, 'packages', 'web', '.claude', 'skills', 'x', 'SKILL.md')
const pluginSkill = path.join(fixtures, 'plugin', 'skills', 's', 'SKILL.md')
const pluginCommand = path.join(fixtures, 'plugin', 'commands', 'c.md')

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-agent-exists-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}
const agentFile = (name: string) => `---\nname: ${name}\ndescription: An agent.\n---\n`
put('outer/.claude/agents/outer.md', agentFile('outer'))
put('outer/repo/.git/HEAD', '')
put('outer/repo/.claude/agents/inrepo.md', agentFile('inrepo'))
put('free/.claude/agents/free.md', agentFile('free'))
// A manifest with a `name` that is not a string, and one that does not parse.
put('numeric/.claude-plugin/plugin.json', '{"name": 3}')
put('numeric/agents/a.md', agentFile('a'))
put('broken/.claude-plugin/plugin.json', '{')
put('broken/agents/a.md', agentFile('a'))
// An agent file in a directory that a link names, and a link that leads back up.
put('linked/shared/team/member.md', agentFile('member'))
mkdirSync(path.join(scratch, 'linked/.claude/agents'), { recursive: true })
symlinkSync('../../shared/team', path.join(scratch, 'linked/.claude/agents/team'))
symlinkSync('..', path.join(scratch, 'linked/.claude/agents/up'))
put('linked/.git/HEAD', '')
// A link that sorts before the directory that it names. The real path keeps its name.
put('twin/.git/HEAD', '')
put('twin/.claude/agents/real/x.md', agentFile('xagent'))
symlinkSync('real', path.join(scratch, 'twin/.claude/agents/a-link'))
put('twinp/.claude-plugin/plugin.json', '{"name": "tp"}')
put('twinp/agents/real/x.md', agentFile('x'))
symlinkSync('real', path.join(scratch, 'twinp/agents/a-link'))
// Blanks after the opening fence, which ESLint accepts for the file that it lints.
put('padded/.git/HEAD', '')
put('padded/.claude/agents/p.md', '---  \nname: padded\n---\n')
// A plugin agent with a `name` that is not a string has the file name.
put('numname/.claude-plugin/plugin.json', '{"name": "nn"}')
put('numname/agents/n.md', '---\nname: 3\n---\n')
// A link out of the repository, from a project and from a plugin in that repository.
put('out/elsewhere/far.md', agentFile('far'))
put('out/repo/.git/HEAD', '')
mkdirSync(path.join(scratch, 'out/repo/.claude/agents'), { recursive: true })
symlinkSync('../../../elsewhere', path.join(scratch, 'out/repo/.claude/agents/team'))
put('outp/.git/HEAD', '')
put('outp/.claude-plugin/plugin.json', '{"name": "outp"}')
mkdirSync(path.join(scratch, 'outp/agents'), { recursive: true })
symlinkSync('../../out/elsewhere', path.join(scratch, 'outp/agents/team'))
// A link out of the repository in a nested project, with an agents directory
// above it that has no link: the walk keeps what the lower scan found.
put('mixed/.git/HEAD', '')
put('mixed/.claude/agents/top.md', agentFile('top'))
mkdirSync(path.join(scratch, 'mixed/sub/.claude/agents'), { recursive: true })
symlinkSync('../../../../out/elsewhere', path.join(scratch, 'mixed/sub/.claude/agents/team'))
// No `.git`: the agents of the project directory still count.
put('nogit/.claude/agents/local.md', agentFile('local'))
// No `.git`: `.claude/` is the bound, so a link from `.claude/agents/` to a directory beside it
// leaves the bound. The agent can be there, so the rule stays silent.
put('nogit/shared/m.md', agentFile('m'))
symlinkSync('../../shared', path.join(scratch, 'nogit/.claude/agents/team'))
// A `.git` entry that is a file, as in a worktree or a submodule.
put('above/.claude/agents/above.md', agentFile('above'))
put('above/wt/.git', 'gitdir: elsewhere')

const fork = (agent: string) => `---\ncontext: fork\nagent: ${agent}\n---\n\n# S\n`

markdownTester.run('skill-agent-exists', ruleOf('skill-agent-exists'), {
  valid: [
    // The example of the docs: `agent: Explore`, with the file as it is on disk.
    {
      code: '---\nname: deep-research\ndescription: Research a topic thoroughly\ncontext: fork\nagent: Explore\n---\n\nResearch $ARGUMENTS thoroughly.\n',
      filename: projectSkill,
    },
    ...[
      'Explore',
      'Plan',
      'general-purpose',
      'claude',
      'statusline-setup',
      'claude-code-guide',
    ].map((agent) => ({ code: fork(agent), filename: projectSkill })),
    // The docs do not give the case rule for names, so the rule ignores case.
    { code: fork('explore'), filename: projectSkill },
    // An agent file of the repository, by its `name`, not by its file name.
    { code: fork('reviewer'), filename: projectSkill },
    { code: fork('security-auditor'), filename: projectSkill },
    // A command file takes `agent` too, and a nested skill sees the agents above it.
    { code: fork('reviewer'), filename: projectCommand },
    { code: fork('reviewer'), filename: nestedSkill },
    // A user-level agent that the `allow` option names.
    {
      code: fork('my-user-agent'),
      options: [{ allow: ['my-user-agent'] }],
      filename: projectSkill,
    },
    // A scoped name is the agent of a plugin that the repository may enable.
    { code: fork('other-plugin:helper'), filename: projectSkill },
    // Letter case does not matter for an agent file, an agent of a plugin, or `allow`.
    { code: fork('REVIEWER'), filename: projectSkill },
    { code: fork('Checker'), filename: pluginSkill },
    { code: fork('P:CHECKER'), filename: pluginSkill },
    {
      code: fork('My-User-Agent'),
      options: [{ allow: ['my-user-agent'] }],
      filename: projectSkill,
    },
    {
      code: fork('my-user-agent'),
      options: [{ allow: ['My-User-Agent'] }],
      filename: projectSkill,
    },
    // The real directory keeps its name when a link to it sorts first.
    {
      code: fork('xagent'),
      filename: path.join(scratch, 'twin', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('tp:real:x'),
      filename: path.join(scratch, 'twinp', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('padded'),
      filename: path.join(scratch, 'padded', '.claude', 'skills', 's', 'SKILL.md'),
    },
    { code: fork('n'), filename: path.join(scratch, 'numname', 'skills', 's', 'SKILL.md') },
    // A scoped name is not a plugin name that the project lacks.
    { code: fork('null:helper'), filename: projectSkill },
    // No value, or a value that is not a string.
    { code: '---\ncontext: fork\n---\n', filename: projectSkill },
    { code: '---\ncontext: fork\nagent:\n---\n', filename: projectSkill },
    { code: '---\ncontext: fork\nagent: [ghost]\n---\n', filename: projectSkill },
    { code: '---\ncontext: fork\nagent: 3\n---\n', filename: projectSkill },
    { code: '---\ncontext: fork\nagent: ""\n---\n', filename: projectSkill },
    { code: '# S\n\nNo frontmatter.\n', filename: projectSkill },
    { code: '---\nagent: [unclosed\n---\n', filename: projectSkill },
    // The agents of a plugin: the bare name, the scoped name, and a file with no `name`.
    { code: fork('checker'), filename: pluginSkill },
    { code: fork('p:checker'), filename: pluginSkill },
    { code: fork('alias'), filename: pluginSkill },
    { code: fork('deep'), filename: pluginSkill },
    { code: fork('p:review:deep'), filename: pluginSkill },
    { code: fork('checker'), filename: pluginCommand },
    { code: fork('Explore'), filename: pluginSkill },
    { code: fork('my-user-agent'), options: [{ allow: ['my-user-agent'] }], filename: pluginSkill },
    // A plugin name is a whole prefix: `pq:` is the scope of another plugin.
    { code: fork('pq:helper'), filename: pluginSkill },
    // A link to a directory of agents is followed, and a link back up is not.
    {
      code: fork('member'),
      filename: path.join(scratch, 'linked', '.claude', 'skills', 's', 'SKILL.md'),
    },
    // The agent of another plugin is out of sight.
    { code: fork('other-plugin:helper'), filename: pluginSkill },
    // The `agents` key replaces the scan of `agents/`, and the rule cannot read it.
    {
      code: fork('anything'),
      filename: path.join(fixtures, 'plugin-agents-key', 'skills', 's', 'SKILL.md'),
    },
    // A manifest with no name: the plugin directory gives the name.
    {
      code: fork('plugin-unnamed:helper'),
      filename: path.join(fixtures, 'plugin-unnamed', 'skills', 's', 'SKILL.md'),
    },
    { code: fork('a'), filename: path.join(scratch, 'numeric', 'skills', 's', 'SKILL.md') },
    { code: fork('numeric:a'), filename: path.join(scratch, 'numeric', 'skills', 's', 'SKILL.md') },
    { code: fork('a'), filename: path.join(scratch, 'broken', 'skills', 's', 'SKILL.md') },
    // The walk up stops at the first directory that holds `.git`.
    {
      code: fork('inrepo'),
      filename: path.join(scratch, 'outer', 'repo', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('inrepo'),
      filename: path.join(scratch, 'outer', 'repo', 'sub', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('ghost'),
      filename: path.join(scratch, 'mixed', 'sub', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('local'),
      filename: path.join(scratch, 'nogit', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('ghost'),
      filename: path.join(scratch, 'nogit', '.claude', 'skills', 's', 'SKILL.md'),
    },
    // A link out of the repository can hold the agent, so the rule stays silent.
    {
      code: fork('far'),
      filename: path.join(scratch, 'out', 'repo', '.claude', 'skills', 's', 'SKILL.md'),
    },
    {
      code: fork('ghost'),
      filename: path.join(scratch, 'out', 'repo', '.claude', 'skills', 's', 'SKILL.md'),
    },
    { code: fork('outp:ghost'), filename: path.join(scratch, 'outp', 'skills', 's', 'SKILL.md') },
    // Not a skill or command file.
    { code: fork('ghost'), filename: path.join(project, 'docs', 'SKILL.md') },
    { code: fork('ghost'), filename: path.join(project, '.claude', 'agents', 'reviewer.md') },
  ],
  invalid: [
    {
      code: fork('ghost'),
      filename: projectSkill,
      errors: [
        { messageId: 'project', data: { agent: 'ghost' }, line: 3, column: 8, endColumn: 13 },
      ],
    },
    // An agent file with no `name`, or with bad YAML, or with no frontmatter, defines no agent.
    ...['noname', 'bad', 'plain'].map((agent) => ({
      code: fork(agent),
      filename: projectSkill,
      errors: [{ messageId: 'project' as const, data: { agent } }],
    })),
    // The agent field counts without `context: fork`: the other rule reports that.
    {
      code: '---\nagent: ghost\n---\n',
      filename: projectSkill,
      errors: [{ messageId: 'project' }],
    },
    { code: fork('ghost'), filename: projectCommand, errors: [{ messageId: 'project' }] },
    { code: fork('ghost'), filename: nestedSkill, errors: [{ messageId: 'project' }] },
    // A name of the `allow` option is the only addition.
    {
      code: fork('other'),
      options: [{ allow: ['my-user-agent'] }],
      filename: projectSkill,
      errors: [{ messageId: 'project' }],
    },
    // A plugin: its own agents, and not the agents of the repository or the user.
    { code: fork('ghost'), filename: pluginSkill, errors: [{ messageId: 'plugin' }] },
    { code: fork('p:ghost'), filename: pluginSkill, errors: [{ messageId: 'plugin' }] },
    { code: fork('reviewer'), filename: pluginSkill, errors: [{ messageId: 'plugin' }] },
    { code: fork('ghost'), filename: pluginCommand, errors: [{ messageId: 'plugin' }] },
    // The fallback name of a plugin is its directory.
    {
      code: fork('plugin-unnamed:ghost'),
      filename: path.join(fixtures, 'plugin-unnamed', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'plugin' }],
    },
    {
      code: fork('numeric:ghost'),
      filename: path.join(scratch, 'numeric', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'plugin' }],
    },
    // A `.git` file stops the walk too.
    {
      code: fork('above'),
      filename: path.join(scratch, 'above', 'wt', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'project' }],
    },
    // A key that is an alias: the report falls back to the start of the frontmatter.
    {
      code: '---\nx: &k agent\n*k : ghost\n---\n',
      filename: projectSkill,
      errors: [{ messageId: 'project', data: { agent: 'ghost' }, line: 2, column: 1 }],
    },
    // Without `.git`, the walk does not go above the directory that holds `.claude/`.
    {
      code: fork('free'),
      filename: path.join(scratch, 'free', 'deep', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'project' }],
    },
    // A link in the repository is followed, so the scan is whole and a missing agent is reported.
    {
      code: fork('ghost'),
      filename: path.join(scratch, 'linked', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'project' }],
    },
    // The agents above a `.git` directory are not the agents of the repository.
    {
      code: fork('outer'),
      filename: path.join(scratch, 'outer', 'repo', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'project' }],
    },
  ],
})

// A read that fails with `EACCES` is not a missing file. The rule cannot see what it
// cannot read, so it makes no report that rests on it.
describe.skipIf(chmodCannotBlock)('a path that the rule cannot read', () => {
  const skill = (tree: string, inside: string) =>
    path.join(scratch, tree, inside, 'skills', 's', 'SKILL.md')
  const ghost = (filename: string) => lintMarkdown('skill-agent-exists', fork('ghost'), filename)

  it('stays silent for an agents directory that it cannot read, and reports when it can', () => {
    put('deny-dir/.git/HEAD', '')
    put('deny-dir/.claude/agents/a.md', agentFile('a'))
    const file = skill('deny-dir', '.claude')
    expect(ghost(file)).toHaveLength(1)
    withoutAccess(path.join(scratch, 'deny-dir/.claude/agents'), () => {
      expect(lintMarkdown('skill-agent-exists', fork('a'), file)).toEqual([])
      expect(ghost(file)).toEqual([])
    })
  })

  it('stays silent for an agent file that it cannot read', () => {
    put('deny-file/.git/HEAD', '')
    const agent = put('deny-file/.claude/agents/a.md', agentFile('a'))
    withoutAccess(agent, () => {
      expect(ghost(skill('deny-file', '.claude'))).toEqual([])
    })
  })

  it('stays silent for a plugin agent file that it cannot read', () => {
    put('deny-plugin-file/.claude-plugin/plugin.json', '{"name": "dp"}')
    const agent = put('deny-plugin-file/agents/a.md', agentFile('a'))
    const file = path.join(scratch, 'deny-plugin-file', 'skills', 's', 'SKILL.md')
    withoutAccess(agent, () => expect(ghost(file)).toEqual([]))
    // The agent file is readable again, so the rule reports a value that no agent defines.
    expect(ghost(file)).toHaveLength(1)
  })

  it('stays silent for a plugin agents directory that it cannot read', () => {
    put('deny-plugin-dir/.claude-plugin/plugin.json', '{"name": "dp"}')
    put('deny-plugin-dir/agents/a.md', agentFile('a'))
    const file = path.join(scratch, 'deny-plugin-dir', 'skills', 's', 'SKILL.md')
    withoutAccess(path.join(scratch, 'deny-plugin-dir/agents'), () =>
      expect(ghost(file)).toEqual([]),
    )
  })

  // A readable file after the unreadable path must not clear the flag.
  it('stays silent for a project agent file that it cannot read, next to a readable one', () => {
    put('deny-mixed/.git/HEAD', '')
    const locked = put('deny-mixed/.claude/agents/a.md', agentFile('a'))
    put('deny-mixed/.claude/agents/b.md', agentFile('b'))
    withoutAccess(locked, () => expect(ghost(skill('deny-mixed', '.claude'))).toEqual([]))
  })

  it('stays silent for a plugin agent file that it cannot read, next to a readable one', () => {
    put('deny-plugin-mixed/.claude-plugin/plugin.json', '{"name": "dp"}')
    const locked = put('deny-plugin-mixed/agents/a.md', agentFile('a'))
    put('deny-plugin-mixed/agents/b.md', agentFile('b'))
    const file = path.join(scratch, 'deny-plugin-mixed', 'skills', 's', 'SKILL.md')
    withoutAccess(locked, () => expect(ghost(file)).toEqual([]))
  })

  it('stays silent for a plugin agents folder that it cannot read, next to a readable file', () => {
    put('deny-plugin-sub/.claude-plugin/plugin.json', '{"name": "dp"}')
    put('deny-plugin-sub/agents/sub/a.md', agentFile('a'))
    put('deny-plugin-sub/agents/b.md', agentFile('b'))
    const file = path.join(scratch, 'deny-plugin-sub', 'skills', 's', 'SKILL.md')
    withoutAccess(path.join(scratch, 'deny-plugin-sub/agents/sub'), () =>
      expect(ghost(file)).toEqual([]),
    )
  })

  it('stays silent for a plugin manifest that it cannot read', () => {
    const manifest = put('deny-manifest/.claude-plugin/plugin.json', '{"agents": "./x"}')
    put('deny-manifest/agents/a.md', agentFile('a'))
    const file = path.join(scratch, 'deny-manifest', 'skills', 's', 'SKILL.md')
    withoutAccess(manifest, () => expect(ghost(file)).toEqual([]))
    withoutAccess(path.dirname(manifest), () => expect(ghost(file)).toEqual([]))
  })
})

// A manifest that the rule cannot see can hold an `agents` key, and a plugin that the rule
// cannot see is not a plugin to judge. The rule makes no report for either.
describe('a plugin manifest that the rule cannot see', () => {
  const ghost = (filename: string) => lintMarkdown('skill-agent-exists', fork('ghost'), filename)

  it.skipIf(process.platform === 'win32')(
    'stays silent when plugin.json is a link out of the repository, with an `agents` key',
    () => {
      put('man-link/.git/HEAD', '')
      put('man-link/agents/a.md', agentFile('a'))
      put('man-link-target/plugin.json', '{"agents": "./x"}')
      mkdirSync(path.join(scratch, 'man-link/.claude-plugin'), { recursive: true })
      symlinkSync(
        '../../man-link-target/plugin.json',
        path.join(scratch, 'man-link/.claude-plugin/plugin.json'),
      )
      expect(ghost(path.join(scratch, 'man-link/skills/s/SKILL.md'))).toEqual([])
      expect(ghost(path.join(scratch, 'man-link/commands/c.md'))).toEqual([])
    },
  )

  it.skipIf(process.platform === 'win32')(
    'stays silent when .claude-plugin/ is a link out of the repository',
    () => {
      put('dir-link/.git/HEAD', '')
      put('dir-link/agents/a.md', agentFile('a'))
      put('dir-link-target/plugin.json', '{}')
      symlinkSync('../dir-link-target', path.join(scratch, 'dir-link/.claude-plugin'))
      expect(ghost(path.join(scratch, 'dir-link/skills/s/SKILL.md'))).toEqual([])
    },
  )

  // The rule cannot read the manifest behind a dangling link, and that manifest can set `agents`.
  it.skipIf(process.platform === 'win32')(
    'stays silent when plugin.json is a dangling link',
    () => {
      put('dangling/skills/s/SKILL.md', '')
      mkdirSync(path.join(scratch, 'dangling/.claude-plugin'), { recursive: true })
      symlinkSync('missing.json', path.join(scratch, 'dangling/.claude-plugin/plugin.json'))
      const file = path.join(scratch, 'dangling/skills/s/SKILL.md')
      expect(ghost(file)).toEqual([])
      expect(lintMarkdown('skill-agent-exists', fork('a'), file)).toEqual([])
      // With a readable manifest that has no `agents` key, the same tree reports the missing agent.
      const manifest = path.join(scratch, 'dangling/.claude-plugin/plugin.json')
      rmSync(manifest)
      writeFileSync(manifest, '{}')
      expect(ghost(file)).toHaveLength(1)
    },
  )

  describe.skipIf(chmodCannotBlock)('with no access to .claude-plugin/', () => {
    it('stays silent for a plugin file, and for a plugin root in `.claude/skills/`', () => {
      put('deny-meta/.git/HEAD', '')
      put('deny-meta/.claude-plugin/plugin.json', '{}')
      put('deny-meta/agents/a.md', agentFile('a'))
      put('deny-meta/.claude/skills/own/.claude-plugin/plugin.json', '{}')
      // Before the lock, the rule reports the ghost agent, so the silence below comes from the lock.
      expect(ghost(path.join(scratch, 'deny-meta/skills/s/SKILL.md'))).toHaveLength(1)
      withoutAccess(path.join(scratch, 'deny-meta/.claude-plugin'), () => {
        expect(ghost(path.join(scratch, 'deny-meta/skills/s/SKILL.md'))).toEqual([])
      })
      // The root `own/` is a plugin, so a project rule does not judge its `SKILL.md`.
      withoutAccess(path.join(scratch, 'deny-meta/.claude/skills/own/.claude-plugin'), () => {
        expect(ghost(path.join(scratch, 'deny-meta/.claude/skills/own/SKILL.md'))).toEqual([])
      })
    })
  })
})

// A manifest that is not a JSON object gives no key, so the rule cannot see the `agents` key.
// It makes no report that rests on `agents/`.
describe('a plugin.json that does not parse to an object', () => {
  it.each([
    ['a syntax error', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a scalar', '3'],
  ])('makes no report for %s', (_name, text) => {
    const tree = `bad-${Buffer.from(text).toString('hex')}`
    put(`${tree}/.claude-plugin/plugin.json`, text)
    put(`${tree}/agents/a.md`, agentFile('a'))
    const file = path.join(scratch, tree, 'skills', 's', 'SKILL.md')
    expect(lintMarkdown('skill-agent-exists', fork('ghost'), file)).toEqual([])
  })
})

// A project `.claude/` is no plugin root, so a manifest in it changes no result (the plugins
// reference puts the manifest under the plugin root). The result is the one with no manifest.
describe('a .claude/.claude-plugin/plugin.json in a project', () => {
  it.each([
    ['a syntax error', '{'],
    ['an `agents` key', '{"agents": "./x"}'],
  ])('does not change the report, for %s', (_name, text) => {
    const tree = `proj-man-${Buffer.from(text).toString('hex')}`
    put(`${tree}/.git/HEAD`, '')
    put(`${tree}/.claude/.claude-plugin/plugin.json`, text)
    put(`${tree}/.claude/agents/a.md`, agentFile('a'))
    const file = path.join(scratch, tree, '.claude', 'skills', 's', 'SKILL.md')
    expect(lintMarkdown('skill-agent-exists', fork('ghost'), file)).toHaveLength(1)
    expect(lintMarkdown('skill-agent-exists', fork('a'), file)).toEqual([])
  })
})

// A `.claude` link whose target holds its own `.git` has the target as its bound, as it has for
// the agent rules. The scan of `.claude/agents/` stays inside that bound, so the rule sees it.
describe.skipIf(process.platform === 'win32')('a .claude link to a repository of its own', () => {
  it('reads the agents in the target, and reports a missing agent', () => {
    put('lnk/.git/HEAD', '')
    put('lnk-target/.git/HEAD', '')
    put('lnk-target/agents/a.md', agentFile('a'))
    symlinkSync('../lnk-target', path.join(scratch, 'lnk/.claude'))
    const file = path.join(scratch, 'lnk', '.claude', 'skills', 's', 'SKILL.md')
    expect(lintMarkdown('skill-agent-exists', fork('a'), file)).toEqual([])
    expect(lintMarkdown('skill-agent-exists', fork('ghost'), file)).toHaveLength(1)
  })
})

// A project directory that is a link to a target out of the repository. The walk goes up the
// path of the link, and stops at the repository that holds the link.
describe.skipIf(process.platform === 'win32')('a project directory that is a link', () => {
  const file = (() => {
    put('lnkwrap/repo/.git/HEAD', '')
    put('lnkwrap/repo/.claude/agents/above.md', agentFile('above-agent'))
    put('lnkproj-target/keep', '')
    put('lnkwrap/.claude/agents/beyond.md', agentFile('beyond-agent'))
    symlinkSync('../../lnkproj-target', path.join(scratch, 'lnkwrap/repo/app'))
    return path.join(scratch, 'lnkwrap', 'repo', 'app', '.claude', 'skills', 's', 'SKILL.md')
  })()
  // The walk must reach the agents of the repository that holds the link.
  it('sees the agents above the link, up to the repository', () => {
    expect(lintMarkdown('skill-agent-exists', fork('above-agent'), file)).toEqual([])
  })
  it('does not see the agents above the repository', () => {
    expect(lintMarkdown('skill-agent-exists', fork('beyond-agent'), file)).toHaveLength(1)
  })
  it('reports a missing agent', () => {
    expect(lintMarkdown('skill-agent-exists', fork('ghost'), file)).toHaveLength(1)
  })
})

// A project directory that is a link to the repository itself. The real path of the link is
// `top`, so the walk stops there. An agent above the repository stays out of sight.
describe.skipIf(process.platform === 'win32')(
  'a project directory that links to the repository',
  () => {
    const file = (() => {
      put('lnkalias/repo/.git/HEAD', '')
      put('lnkalias/repo/.claude/agents/inrepo.md', agentFile('inrepo-agent'))
      put('lnkalias/.claude/agents/beyond.md', agentFile('beyond-agent'))
      symlinkSync('repo', path.join(scratch, 'lnkalias/alias'))
      return path.join(scratch, 'lnkalias', 'alias', '.claude', 'skills', 's', 'SKILL.md')
    })()
    it('sees the agents of the repository', () => {
      expect(lintMarkdown('skill-agent-exists', fork('inrepo-agent'), file)).toEqual([])
    })
    it('does not see the agents above the repository', () => {
      expect(lintMarkdown('skill-agent-exists', fork('beyond-agent'), file)).toHaveLength(1)
    })
  },
)
