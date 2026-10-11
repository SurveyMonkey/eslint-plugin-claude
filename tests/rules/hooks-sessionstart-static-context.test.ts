// The hooks reference says of `additionalContext`: "For instructions that never change, prefer CLAUDE.md. It
// loads without running a script" (https://code.claude.com/docs/en/hooks#add-context-for-claude). The memory page
// says of a `SessionStart` hook that prints `AGENTS.md`: "remove it. Once Claude reads `AGENTS.md` directly, the
// hook adds a second copy to the context"
// (https://code.claude.com/docs/en/memory#remove-an-earlier-agents-md-workaround). The rule is a heuristic. It
// reports a `SessionStart` command that only echoes text with no variable, and one that prints `AGENTS.md`.
import { describe, expect, it } from 'vitest'
import { command, hooks, settings } from '../hooks.test-support.ts'
import { lintInline, lintScript, unreadable } from '../hooks-output.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'hooks-sessionstart-static-context'

const inline = (line: string, event = 'SessionStart', fields: Record<string, unknown> = {}) =>
  lintInline(name, { event, fields }, line)
const script = (body: string, event = 'SessionStart') =>
  lintScript(name, { 'hooks/s.sh': body }, { event })
const context = (fields: Record<string, unknown>) =>
  `echo '${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', ...fields } })}'`

describe(`${name}: static text`, () => {
  it('reports an echo of static text', () => {
    for (const line of [
      'echo "static"',
      "echo 'Use bun test'",
      'echo Use bun test',
      'printf "Use bun test\\n"',
      'echo one; echo two',
      'echo -n "static"',
    ]) {
      expect(inline(line), line).toEqual(['staticText'])
    }
  })

  it('reports an echo of JSON that holds only additionalContext', () => {
    expect(inline(context({ additionalContext: 'This repo uses bun test' }))).toEqual([
      'staticText',
    ])
  })

  it('reports a file that a branch of a block prints', () => {
    for (const line of [
      'if [ -f AGENTS.md ]; then cat AGENTS.md; fi',
      'test -f AGENTS.md && { cat AGENTS.md; }',
    ]) {
      expect(inline(line), line).toEqual(['agentsFile'])
    }
  })

  it('reports a script that only echoes static text', () => {
    expect(script('#!/bin/bash\n# context\necho "This repo uses bun test"\n')).toEqual([
      'staticText',
    ])
  })

  it('names the file to use in the message', () => {
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [command({ command: 'echo "static"' })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'This SessionStart hook only prints text that never changes. Put the text in CLAUDE.md. CLAUDE.md loads without running a script.',
    )
  })
})

describe(`${name}: AGENTS.md`, () => {
  it('reports a command that prints AGENTS.md', () => {
    for (const line of [
      'cat AGENTS.md',
      'cat ./AGENTS.md',
      'cat "$CLAUDE_PROJECT_DIR/AGENTS.md"',
      'cat docs/AGENTS.md README.md',
      'head -n 50 AGENTS.md',
      'tail AGENTS.md',
      'bat AGENTS.md',
      'less AGENTS.md',
      'more AGENTS.md',
      'exec cat AGENTS.md',
      'cd "$CLAUDE_PROJECT_DIR" && cat AGENTS.md',
    ]) {
      expect(inline(line), line).toEqual(['agentsFile'])
    }
  })

  it('reports a script that prints AGENTS.md, and names AGENTS.md in the message', () => {
    expect(script('#!/bin/bash\ncat "$CLAUDE_PROJECT_DIR/AGENTS.md"\n')).toEqual(['agentsFile'])
    const [message] = lintJson(
      name,
      settings(hooks('SessionStart', [command({ command: 'cat AGENTS.md' })])),
      '/repo/.claude/settings.json',
    )
    expect(message?.message).toBe(
      'This SessionStart hook prints AGENTS.md. Once Claude reads AGENTS.md directly, the hook adds a second copy to the context. Remove the hook.',
    )
  })

  it('is silent for AGENTS.md that is not printed to stdout, or not as a file name', () => {
    for (const line of [
      'cat AGENTS.md > /tmp/x',
      'cat agents.md',
      'cat AGENTS.md.bak',
      'cat MYAGENTS.md',
      'grep todo AGENTS.md',
      'wc -l AGENTS.md',
      'cat AGENTS.md >&2',
    ]) {
      expect(inline(line), line).toEqual([])
    }
  })
})

describe(`${name}: silent`, () => {
  it('is silent for a command that is dynamic', () => {
    for (const line of [
      'git status --short',
      'echo "Branch: $(git branch --show-current)"',
      'echo "Branch: `git branch`"',
      'echo "Home: $HOME"',
      'echo $(date)',
      'echo "static" | tee /tmp/x',
      'x=$(echo static)',
      'echo "static" | cat',
      'echo "static"; git status',
      'echo "static" >> "$CLAUDE_ENV_FILE"',
      'echo "static" > file',
      'echo',
      'echo ""',
      './context.sh',
      'FOO=bar',
      "bash -c 'echo hi'",
    ]) {
      expect(inline(line), line).toEqual([])
    }
  })

  it('is silent for the JSON patterns of the docs that are not only context', () => {
    for (const fields of [
      { reloadSkills: true },
      { additionalContext: 'x', sessionTitle: 'auth' },
      { watchPaths: ['/a'] },
      { initialUserMessage: 'hi' },
    ]) {
      expect(inline(context(fields)), JSON.stringify(fields)).toEqual([])
    }
    expect(
      inline(`echo '{"systemMessage":"x","hookSpecificOutput":{"additionalContext":"y"}}'`),
    ).toEqual([])
    expect(inline(`echo '{"hookSpecificOutput":{"additionalContext":5}}'`)).toEqual([])
    expect(inline(`echo '{"hookSpecificOutput":{"additionalContext":""}}'`)).toEqual([])
    expect(inline(`echo '{"hookSpecificOutput":"x"}'`)).toEqual([])
    expect(inline(`echo '{"hookSpecificOutput":{"hookEventName":"SessionStart"}}'`)).toEqual([])
  })

  it('is silent for static text that is not on stdout', () => {
    expect(inline('echo "static" >&2')).toEqual([])
  })

  it('is silent for another event', () => {
    for (const event of ['UserPromptSubmit', 'Setup', 'PostToolUse', 'SubagentStart']) {
      expect(inline('echo "static"', event), event).toEqual([])
      expect(inline('cat AGENTS.md', event), event).toEqual([])
    }
  })

  it('is silent for a script with more than echo, and judges the script and not the launcher', () => {
    expect(script('#!/bin/bash\ngit status\necho "static"\n')).toEqual([])
    expect(script('#!/bin/bash\necho "$BRANCH"\n')).toEqual([])
    expect(script('#!/bin/bash\n\n')).toEqual([])
  })

  it('is silent for a handler that is no command or that is for powershell', () => {
    const http = settings(hooks('SessionStart', [{ type: 'http', url: 'https://x.example' }]))
    expect(lintJson(name, http, '/repo/.claude/settings.json')).toEqual([])
    expect(inline('echo "static"', 'SessionStart', { shell: 'powershell' })).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    const text = settings(hooks('SessionStart', [command({ command: 'echo "static"' })]))
    expect(lintJson(name, text, '/repo/managed-settings.d/.10.json')).toEqual([])
  })

  it('is silent for a script that it cannot read', () => {
    const body = '#!/bin/bash\necho "static"\n'
    expect(script(body)).toEqual(['staticText'])
    for (const [what, found] of unreadable(name, body, { event: 'SessionStart' })) {
      expect(found, what).toEqual([])
    }
  })
})
