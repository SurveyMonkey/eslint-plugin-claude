// The `agent` field of a skill or command file must name a built-in agent, an
// agent file the repository holds, or an agent of the plugin. The trees are on
// disk under tests/fixtures/skill-agent-exists/. The `.git` stop of the walk
// up needs a directory that git would not commit, so those trees are built at
// run time.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'
import { markdownTester, ruleOf } from '../rule-tester.test-support.ts'

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
    // Without `.git`, the walk goes on above the directory.
    {
      code: fork('free'),
      filename: path.join(scratch, 'free', 'deep', '.claude', 'skills', 's', 'SKILL.md'),
    },
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
    // The agents above a `.git` directory are not the agents of the repository.
    {
      code: fork('outer'),
      filename: path.join(scratch, 'outer', 'repo', '.claude', 'skills', 's', 'SKILL.md'),
      errors: [{ messageId: 'project' }],
    },
  ],
})
