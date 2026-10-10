// The errors page: "The combined descriptions of your subagents, except the built-in ones, exceed
// 15,000 tokens as Claude Code estimates them." The same page: "Each agent counts its name plus its
// `description` frontmatter." The docs give no characters per token, so the rule estimates. The rule sums the agents of one scope, on disk.
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lintAgent } from '../agent-rules.test-support.ts'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const unreadable = chmodCannotBlock ? it.skip : it
const posix = process.platform === 'win32' ? it.skip : it
const agent = (name: string, chars: number) =>
  `---\nname: ${name}\ndescription: ${'x'.repeat(chars)}\n---\n\nBody.\n`
const manifest = (agents: unknown) => JSON.stringify({ name: 'p', agents })
const PLUGIN = { 'plugins/p/.claude-plugin/plugin.json': '{"name":"p"}' }

/** The messages for `code` at `place`, in a new repository with `files`. */
function run(
  code: string,
  place: string,
  files: Record<string, string> = {},
  options: unknown[] = [],
) {
  const root = repo({ ...PLUGIN, ...files })
  return lintAgent('agent-descriptions-budget', code, path.join(root, place), options)
}

// One agent of 30000 characters, with the name `a`. The sibling `b` has the name and the rest.
const A = agent('a', 29999)
const LOCAL = '.claude/agents/a.md'
const sibling = (chars: number, at = '.claude/agents/b.md') => ({ [at]: agent('b', chars) })

describe('agent-descriptions-budget', () => {
  it('reports a scope over 15000 tokens, at line 1 of each agent file', () => {
    // 30000 + 30001 + 2 = 60003 characters, at 4 characters per token, is 15001 tokens.
    const files = { ...sibling(30000), '.claude/agents/c.md': agent('c', 1) }
    expect(run(A, LOCAL, files)).toMatchObject([
      { messageId: 'overDefault', line: 1, column: 1, endLine: 1, endColumn: 1 },
    ])
    const message = run(A, LOCAL, files)[0]?.message ?? ''
    expect(message).toContain('15001')
    // a: 1 + 29999, b: 1 + 30000, c: 1 + 1. The file under test adds 30000.
    expect(message).toContain('60003 characters')
    expect(message).toContain('this file adds 30000 characters')
    expect(message).toContain('4 characters per token')
    expect(message).toContain('limit is 15000 tokens')
  })

  it('stays at the limit with exactly 15000 tokens', () => {
    expect(run(A, LOCAL, sibling(29999))).toEqual([])
  })

  it('reports each place of an agent', () => {
    const over = sibling(30000, 'plugins/p/agents/b.md')
    expect(run(A, 'plugins/p/agents/a.md', over)).toHaveLength(1)
    expect(run(A, '.claude/agents/team/a.md', { ...sibling(30000), ...over })).toHaveLength(1)
    const listed = {
      'plugins/r/.claude-plugin/plugin.json': manifest(['./custom/a.md', './more/b.md']),
      'plugins/r/more/b.md': agent('b', 30000),
    }
    expect(run(A, 'plugins/r/custom/a.md', listed)).toHaveLength(1)
  })

  it('counts the agents of a subfolder', () => {
    expect(run(A, LOCAL, sibling(30000, '.claude/agents/team/deep/b.md'))).toHaveLength(1)
  })

  it('reads the file that it lints from the editor, not from the disk', () => {
    const files = { [LOCAL]: agent('a', 1), ...sibling(30000) }
    expect(run(A, LOCAL, files)).toHaveLength(1)
    expect(run(agent('a', 1), LOCAL, { [LOCAL]: A, ...sibling(30000) })).toEqual([])
  })

  it('reports an agent that is not on disk', () => {
    expect(run(agent('a', 60001), LOCAL)).toHaveLength(1)
  })

  describe('the options', () => {
    it('maxTokens moves the limit, and the message names it', () => {
      const files = sibling(100)
      expect(run(agent('a', 100), LOCAL, files, [{ maxTokens: 50 }])).toMatchObject([
        { messageId: 'overConfigured' },
      ])
      const message = run(agent('a', 100), LOCAL, files, [{ maxTokens: 50 }])[0]?.message ?? ''
      expect(message).toContain('configured limit is 50 tokens')
      // a and b add 101 characters each, so 202 characters is 51 tokens at 4 per token.
      expect(message).toContain('about 51 tokens')
      expect(message).toContain('(202 characters at 4 characters per token)')
      expect(message).toContain('this file adds 101 characters')
      expect(message).not.toContain('startup')
      expect(run(agent('a', 100), LOCAL, files, [{ maxTokens: 51 }])).toEqual([])
    })
    it('charsPerToken sets the estimate', () => {
      // 202 characters: 101 tokens at 2 per token, 68 at 3 per token.
      const files = sibling(100)
      expect(
        run(agent('a', 100), LOCAL, files, [{ maxTokens: 100, charsPerToken: 2 }]),
      ).toHaveLength(1)
      expect(run(agent('a', 100), LOCAL, files, [{ maxTokens: 100, charsPerToken: 3 }])).toEqual([])
      const message =
        run(agent('a', 100), LOCAL, files, [{ maxTokens: 100, charsPerToken: 2 }])[0]?.message ?? ''
      expect(message).toContain('2 characters per token')
    })
    it('charsPerToken can be a fraction', () => {
      // 202 characters at 1.5 per token is 135 tokens.
      expect(
        run(agent('a', 100), LOCAL, sibling(100), [{ maxTokens: 134, charsPerToken: 1.5 }]),
      ).toHaveLength(1)
      expect(
        run(agent('a', 100), LOCAL, sibling(100), [{ maxTokens: 135, charsPerToken: 1.5 }]),
      ).toEqual([])
    })
    it('refuses a maxTokens or charsPerToken below one, and a key it does not know', () => {
      for (const option of [
        { maxTokens: 0 },
        { charsPerToken: 0.5 },
        { max: 5 },
        { maxTokens: 1.5 },
      ]) {
        expect(() => run(A, LOCAL, {}, [option]), JSON.stringify(option)).toThrow(/Value .* should/)
      }
    })
  })

  describe('what counts', () => {
    it('does not count a built-in name, in the file or in a sibling', () => {
      const files = { '.claude/agents/e.md': agent('Explore', 30000) }
      expect(run(A, LOCAL, files)).toEqual([])
      // The built-in file adds nothing, so it gets no report.
      expect(run(agent('Explore', 90000), LOCAL, sibling(30000))).toEqual([])
      expect(run(agent('claude-code-guide', 90000), LOCAL)).toEqual([])
    })
    it('adds nothing for a built-in name or a skipped file, at the limit', () => {
      // 30000 + 30000 characters is exactly 15000 tokens. Any extra character is over the limit.
      const files = {
        ...sibling(29999),
        '.claude/agents/e.md': agent('Explore', 10),
        '.claude/agents/skipped.md': '---\nname: x\n---\n',
      }
      expect(run(A, LOCAL, files)).toEqual([])
    })
    it('ignores a name of white space', () => {
      // The name of three spaces does not count. With it, the sum is 60001 characters.
      const files = {
        '.claude/agents/b.md': `---\nname: "   "\ndescription: ${'x'.repeat(29998)}\n---\n`,
      }
      expect(run(A, LOCAL, files)).toEqual([])
    })
    it('counts a name that only differs in letter case from a built-in name', () => {
      expect(run(A, LOCAL, { '.claude/agents/e.md': agent('explore', 30000) })).toHaveLength(1)
    })
    it('counts name plus description of a plugin agent that has no name', () => {
      // The file name `stem` adds four characters: 30000 + 4 + 29999 = 60003 characters.
      const nameless = `---\ndescription: ${'x'.repeat(29999)}\n---\n`
      const at = 'plugins/p/agents/a.md'
      expect(run(A, at, { 'plugins/p/agents/stem.md': nameless })).toHaveLength(1)
      // The file name `s` adds one character: 60000 characters.
      expect(run(A, at, { 'plugins/p/agents/s.md': nameless })).toEqual([])
    })
    it('counts the file name of a plugin agent with no frontmatter', () => {
      // The name `plain` adds five characters: 30000 + 5 + 29996 = 60001 characters.
      const files = {
        'plugins/p/agents/plain.md': 'Body only.\n',
        ...sibling(29995, 'plugins/p/agents/b.md'),
      }
      expect(run(A, 'plugins/p/agents/a.md', files)).toHaveLength(1)
      expect(
        run(A, 'plugins/p/agents/a.md', { ...files, 'plugins/p/agents/b.md': agent('b', 29994) }),
      ).toEqual([])
    })
    it('does not count a local file without a name or a description', () => {
      const files = {
        '.claude/agents/noname.md': `---\ndescription: ${'x'.repeat(30000)}\n---\n`,
        '.claude/agents/nodesc.md': `---\nname: ${'y'.repeat(30001)}\n---\n`,
        '.claude/agents/blank.md': `---\nname: ${'z'.repeat(30001)}\ndescription: "   "\n---\n`,
        '.claude/agents/bad.md': '---\nname: [x\n---\n',
        '.claude/agents/plain.md': 'x'.repeat(40000),
        '.claude/agents/notes.txt': agent('n', 40000),
      }
      expect(run(A, LOCAL, files)).toEqual([])
    })
    it('does not count a field that is not a string', () => {
      const files = {
        '.claude/agents/list.md': '---\nname: [a, b]\ndescription: [c, d]\n---\n',
        '.claude/agents/number.md': '---\nname: 5\ndescription: 7\n---\n',
      }
      expect(run(agent('a', 30000), LOCAL, { ...files, ...sibling(29998) })).toEqual([])
    })
    it('does not count the agents of another scope', () => {
      const files = {
        '.claude/agents/big.md': agent('big', 90000),
        'packages/x/.claude/agents/big.md': agent('big', 90000),
      }
      expect(run(A, 'packages/y/.claude/agents/a.md', files)).toEqual([])
      expect(run(A, 'plugins/p/agents/a.md', files)).toEqual([])
      expect(run(A, LOCAL, { ...files, ...sibling(1) })).toHaveLength(1)
    })
  })

  describe('a plugin manifest with the key agents', () => {
    const files = {
      'plugins/r/.claude-plugin/plugin.json': manifest(['./custom/a.md', './more/b.md']),
      'plugins/r/more/b.md': agent('b', 30000),
    }
    it('counts the listed files and leaves out the agents/ folder', () => {
      const extra = { ...files, 'plugins/r/agents/c.md': agent('c', 90000) }
      expect(run(A, 'plugins/r/custom/a.md', extra)).toHaveLength(1)
      const small = { ...files, 'plugins/r/more/b.md': agent('b', 1) }
      expect(
        run(A, 'plugins/r/custom/a.md', { ...small, 'plugins/r/agents/c.md': agent('c', 90000) }),
      ).toEqual([])
    })
    it('reads the string form', () => {
      const one = { 'plugins/r/.claude-plugin/plugin.json': manifest('./custom/a.md') }
      expect(run(agent('a', 60001), 'plugins/r/custom/a.md', one)).toHaveLength(1)
    })
    it('gives no report for a file that the manifest leaves out', () => {
      expect(run(agent('a', 90000), 'plugins/r/agents/c.md', files)).toEqual([])
      expect(run(agent('a', 90000), 'plugins/r/custom/other.md', files)).toEqual([])
    })
    it('leaves out a path that the plugin does not load', () => {
      const odd = {
        'plugins/r/.claude-plugin/plugin.json': manifest([
          './custom/a.md',
          '../outside/b.md',
          './../outside/b.md',
          'more/b.md',
          './more/b.txt',
          './more',
          './missing.md',
          './custom/a.md',
        ]),
        'plugins/outside/b.md': agent('b', 40000),
        'plugins/r/more/b.md': agent('b', 40000),
        'plugins/r/more/b.txt': agent('b', 40000),
      }
      expect(run(A, 'plugins/r/custom/a.md', odd)).toEqual([])
    })
    it('adds nothing for a listed file that is not there', () => {
      // 30000 + 30000 characters is 15000 tokens. The name `missing` would add 7 characters.
      const absent = {
        'plugins/r/.claude-plugin/plugin.json': manifest([
          './custom/a.md',
          './more/b.md',
          './missing.md',
        ]),
        'plugins/r/more/b.md': agent('b', 29999),
      }
      expect(run(A, 'plugins/r/custom/a.md', absent)).toEqual([])
    })
    it('counts a file once when the list names it twice', () => {
      const twice = {
        'plugins/r/.claude-plugin/plugin.json': manifest([
          './custom/a.md',
          './more/b.md',
          './more/b.md',
        ]),
        'plugins/r/more/b.md': agent('b', 20000),
      }
      expect(run(A, 'plugins/r/custom/a.md', twice)).toEqual([])
    })
    it('gives no report when the manifest does not say which files load', () => {
      for (const agents of [5, { a: 1 }, ['./custom/a.md', 5]]) {
        const bad = { 'plugins/r/.claude-plugin/plugin.json': manifest(agents) }
        expect(
          run(agent('a', 90000), 'plugins/r/agents/a.md', bad),
          JSON.stringify(agents),
        ).toEqual([])
      }
      const text = { 'plugins/r/.claude-plugin/plugin.json': '{' }
      expect(run(agent('a', 90000), 'plugins/r/agents/a.md', text)).toEqual([])
    })
    it('keeps the agents/ folder when the manifest has no agents key', () => {
      const none = {
        'plugins/r/.claude-plugin/plugin.json': '{"name":"r"}',
        ...sibling(30000, 'plugins/r/agents/b.md'),
      }
      expect(run(A, 'plugins/r/agents/a.md', none)).toHaveLength(1)
    })
  })

  describe('gives no report when it cannot see the scope', () => {
    // Each case below has a visible part that is over the limit, so only the part that the rule
    // cannot see holds back the report.
    unreadable('when an agent file cannot be read', () => {
      const root = repo({ ...PLUGIN, ...sibling(30000), '.claude/agents/c.md': agent('c', 30000) })
      withoutAccess(path.join(root, '.claude/agents/b.md'), () => {
        expect(lintAgent('agent-descriptions-budget', A, path.join(root, LOCAL))).toEqual([])
      })
    })
    unreadable('when a folder in agents cannot be read', () => {
      const root = repo({
        ...PLUGIN,
        ...sibling(30000, '.claude/agents/team/b.md'),
        '.claude/agents/c.md': agent('c', 30000),
      })
      withoutAccess(path.join(root, '.claude/agents/team'), () => {
        expect(lintAgent('agent-descriptions-budget', A, path.join(root, LOCAL))).toEqual([])
      })
    })
    unreadable('when a listed file is in a folder that cannot be read', () => {
      const root = repo({
        'plugins/r/.claude-plugin/plugin.json': manifest(['./custom/a.md', './locked/b.md']),
        'plugins/r/locked/b.md': agent('b', 10),
      })
      withoutAccess(path.join(root, 'plugins/r/locked'), () => {
        const self = path.join(root, 'plugins/r/custom/a.md')
        expect(lintAgent('agent-descriptions-budget', agent('a', 90000), self)).toEqual([])
      })
    })
    posix('when a link in agents/ leads out of the repository', () => {
      const root = repo({ ...PLUGIN, ...sibling(30000) })
      const outside = path.join(path.dirname(root), 'outside-agents')
      mkdirSync(outside, { recursive: true })
      writeFileSync(path.join(outside, 'o.md'), agent('o', 10))
      symlinkSync(outside, path.join(root, '.claude/agents/out'))
      expect(lintAgent('agent-descriptions-budget', A, path.join(root, LOCAL))).toEqual([])
    })
    posix('when .claude is a dangling link', () => {
      const root = repo(PLUGIN)
      symlinkSync('nowhere', path.join(root, '.claude'))
      expect(
        lintAgent('agent-descriptions-budget', agent('a', 90000), path.join(root, LOCAL)),
      ).toEqual([])
    })
    posix('when agents is a dangling link', () => {
      const root = repo({ ...PLUGIN, '.claude/x': '' })
      symlinkSync('nowhere', path.join(root, '.claude/agents'))
      expect(
        lintAgent('agent-descriptions-budget', agent('a', 90000), path.join(root, LOCAL)),
      ).toEqual([])
      const plugin = path.join(root, 'plugins/p')
      symlinkSync('nowhere', path.join(plugin, 'agents'))
      expect(
        lintAgent('agent-descriptions-budget', agent('a', 90000), path.join(plugin, 'agents/a.md')),
      ).toEqual([])
    })
    posix('when a listed file is a dangling link or a link out of the repository', () => {
      const root = repo({
        'plugins/r/.claude-plugin/plugin.json': manifest(['./custom/a.md', './more/gone.md']),
        'plugins/r/more/x': '',
      })
      symlinkSync('nowhere.md', path.join(root, 'plugins/r/more/gone.md'))
      const self = path.join(root, 'plugins/r/custom/a.md')
      expect(lintAgent('agent-descriptions-budget', agent('a', 90000), self)).toEqual([])
      const outside = path.join(path.dirname(root), 'outside-agent.md')
      writeFileSync(outside, agent('o', 10))
      symlinkSync(outside, path.join(root, 'plugins/r/more/out.md'))
      writeFileSync(
        path.join(root, 'plugins/r/.claude-plugin/plugin.json'),
        manifest(['./custom/a.md', './more/out.md']),
      )
      expect(lintAgent('agent-descriptions-budget', agent('a', 90000), self)).toEqual([])
    })
    posix('when a listed file is a link out of the plugin root, inside the repository', () => {
      const root = repo({
        'plugins/r/.claude-plugin/plugin.json': manifest(['./custom/a.md', './more/link.md']),
        'plugins/r/more/x': '',
        'plugins/sibling/real.md': agent('l', 90000),
      })
      symlinkSync(
        path.join(root, 'plugins/sibling/real.md'),
        path.join(root, 'plugins/r/more/link.md'),
      )
      const self = path.join(root, 'plugins/r/custom/a.md')
      // Claude Code does not load the link, so it adds nothing to the sum.
      expect(lintAgent('agent-descriptions-budget', agent('a', 1000), self)).toEqual([])
      unlinkSync(path.join(root, 'plugins/r/more/link.md'))
      writeFileSync(path.join(root, 'plugins/r/more/link.md'), agent('l', 90000))
      expect(lintAgent('agent-descriptions-budget', agent('a', 1000), self)).toHaveLength(1)
    })
    it('when the file is no agent file', () => {
      expect(run(agent('a', 90000), 'docs/a.md', sibling(30000))).toEqual([])
      expect(run(agent('a', 90000), 'plugins/p/other/a.md')).toEqual([])
    })
    it('when the file has no frontmatter, or a block that does not parse', () => {
      expect(run('Body only.\n', LOCAL, sibling(90000))).toEqual([])
      expect(run('---\nname: [x\n---\n', LOCAL, sibling(90000))).toEqual([])
    })
  })
})
