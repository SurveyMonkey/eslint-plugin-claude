// The hooks guide shows its example hook script with a `#!/bin/bash` first line, and says that "Hook scripts must be
// executable" (https://code.claude.com/docs/en/hooks-guide#block-edits-to-protected-files). A script that a
// hook runs directly needs a shebang line to name its interpreter. The docs do not state that rule, so it is a
// practice check. The rule reads the first line of a repository script that `${CLAUDE_PROJECT_DIR}` or
// `${CLAUDE_PLUGIN_ROOT}` names. It reports nothing for a file that it cannot read in the repository.
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { command, frontmatter, hooks, markdownIds, settings } from '../hooks.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

const name = 'hooks-script-shebang'
const P = `\${CLAUDE_PROJECT_DIR}`
const R = `\${CLAUDE_PLUGIN_ROOT}`
// The system tool that makes a FIFO. Node has no call for it.
const MAKE_FIFO = 'mkfifo'
const GOOD = '#!/bin/bash\necho ok\n'
const BAD = 'echo ok\n'

/** The message ids for the handler fields `fields` in the settings file of a repository with `files`. */
function ids(
  files: Record<string, string>,
  fields: Record<string, unknown>,
  target = '.claude/settings.json',
) {
  const text = settings(hooks('PostToolUse', [command(fields)], 'Write'))
  const root = repo({ ...files, [target]: text })
  return lintJson(name, text, path.join(root, target)).map((message) => message.messageId)
}
const run = (line: string, files: Record<string, string> = { 'hooks/b.sh': BAD }) =>
  ids(files, { command: line })

describe(`${name}: the report`, () => {
  it('reports a script with no shebang, in each form of the placeholder', () => {
    for (const line of [
      `${P}/hooks/b.sh`,
      `"${P}/hooks/b.sh"`,
      `"${P}"/hooks/b.sh`,
      `$CLAUDE_PROJECT_DIR/hooks/b.sh`,
      `${P}/hooks/b.sh --fix`,
      `exec ${P}/hooks/b.sh`,
      `echo x && ${P}/hooks/b.sh`,
    ]) {
      expect(run(line), line).toEqual(['shebang'])
    }
  })

  it('reports a script in exec form', () => {
    expect(ids({ 'hooks/b.sh': BAD }, { command: `${P}/hooks/b.sh`, args: ['x'] })).toEqual([
      'shebang',
    ])
  })

  it('reads exec form with an args item that is no string', () => {
    expect(ids({ 'hooks/b.sh': BAD }, { command: `${P}/hooks/b.sh`, args: [5, null] })).toEqual([
      'shebang',
    ])
  })

  it('reports each script of a line', () => {
    expect(
      run(`${P}/hooks/b.sh; ${P}/hooks/c.sh`, { 'hooks/b.sh': BAD, 'hooks/c.sh': '' }),
    ).toEqual(['shebang', 'shebang'])
  })

  it('reports a script behind a link inside the repository', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/link.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'real/b.sh': BAD })
    mkdirSync(path.join(root, 'hooks'))
    symlinkSync(path.join(root, 'real/b.sh'), path.join(root, 'hooks/link.sh'))
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toHaveLength(1)
  })

  it('names the script in the message', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/b.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/b.sh': BAD })
    const [message] = lintJson(name, text, path.join(root, '.claude/settings.json'))
    expect(message?.message).toBe(
      'The script "b.sh" starts with no "#!" line, and this hook runs it directly. Start the file with a shebang line such as "#!/bin/bash".',
    )
  })

  it('reports in a plugin hooks.json with CLAUDE_PLUGIN_ROOT', () => {
    const text = settings(hooks('Stop', [command({ command: `"${R}/scripts/b.sh"` })]))
    const root = repo({ 'plugins/p/hooks/hooks.json': text, 'plugins/p/scripts/b.sh': BAD })
    expect(lintJson(name, text, path.join(root, 'plugins/p/hooks/hooks.json'))).toHaveLength(1)
  })

  it('reports a script behind a link out of the plugin, but inside the repository', () => {
    const text = settings(hooks('Stop', [command({ command: `${R}/scripts/l.sh` })]))
    const root = repo({ 'plugins/p/hooks/hooks.json': text, 'shared/b.sh': BAD })
    mkdirSync(path.join(root, 'plugins/p/scripts'))
    symlinkSync(path.join(root, 'shared/b.sh'), path.join(root, 'plugins/p/scripts/l.sh'))
    expect(lintJson(name, text, path.join(root, 'plugins/p/hooks/hooks.json'))).toHaveLength(1)
  })

  it('reports a script in each form of the placeholder, with the plugin form unbraced', () => {
    const text = settings(hooks('Stop', [command({ command: '$CLAUDE_PLUGIN_ROOT/scripts/b.sh' })]))
    const root = repo({ 'plugins/p/hooks/hooks.json': text, 'plugins/p/scripts/b.sh': BAD })
    expect(lintJson(name, text, path.join(root, 'plugins/p/hooks/hooks.json'))).toHaveLength(1)
  })

  it('reports a script in exec form where shell is ignored', () => {
    expect(
      ids({ 'hooks/b.sh': BAD }, { command: `${P}/hooks/b.sh`, args: [], shell: 'powershell' }),
    ).toEqual(['shebang'])
  })

  it('reports a shebang that is not on the first line', () => {
    for (const text of ['echo ok\n#!/bin/bash\n', '\n#!/bin/bash\n']) {
      expect(run(`${P}/hooks/b.sh`, { 'hooks/b.sh': text }), text).toEqual(['shebang'])
    }
  })

  it('reports in a project skill and a project agent', () => {
    const yaml = `Stop:\n  - hooks:\n      - type: command\n        command: "\${CLAUDE_PROJECT_DIR}/hooks/b.sh"\n`
    for (const file of ['.claude/skills/s/SKILL.md', '.claude/agents/a.md']) {
      const text = frontmatter(yaml)
      const root = repo({ [file]: text, 'hooks/b.sh': BAD })
      expect(markdownIds(name, text, path.join(root, file)), file).toEqual(['shebang'])
    }
  })
})

describe(`${name}: the silent cases`, () => {
  it('is silent when the script starts with #!', () => {
    expect(run(`${P}/hooks/b.sh`, { 'hooks/b.sh': GOOD })).toEqual([])
    expect(run(`${P}/hooks/b.sh`, { 'hooks/b.sh': '#!/usr/bin/env node\n' })).toEqual([])
  })

  it('is silent when an interpreter runs the script', () => {
    for (const line of [
      `bash ${P}/hooks/b.sh`,
      `node ${P}/hooks/b.sh`,
      `sh -e "${P}/hooks/b.sh"`,
    ]) {
      expect(run(line), line).toEqual([])
    }
  })

  it('is silent for a path that the placeholders do not name', () => {
    for (const line of [
      './hooks/b.sh',
      'hooks/b.sh',
      '/abs/b.sh',
      `${R}/hooks/b.sh`,
      '$HOME/b.sh',
      'echo x',
    ]) {
      expect(run(line), line).toEqual([])
    }
    expect(ids({ 'hooks/b.sh': BAD }, { command: `${R}/hooks/b.sh` })).toEqual([])
  })

  it('is silent for CLAUDE_PROJECT_DIR in a managed file inside a .claude folder', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/b.sh` })]))
    const root = repo({ '.claude/managed-settings.json': text, 'hooks/b.sh': BAD })
    expect(lintJson(name, text, path.join(root, '.claude/managed-settings.json'))).toEqual([])
  })

  it('is silent for CLAUDE_PROJECT_DIR in a plugin file and in a managed file', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/b.sh` })]))
    const root = repo({
      'plugins/p/hooks/hooks.json': text,
      'managed-settings.json': text,
      'managed-settings.d/.10.json': text,
      'plugins/p/hooks/b.sh': BAD,
      'hooks/b.sh': BAD,
    })
    for (const file of [
      'plugins/p/hooks/hooks.json',
      'managed-settings.json',
      'managed-settings.d/.10.json',
    ]) {
      expect(lintJson(name, text, path.join(root, file)), file).toEqual([])
    }
  })

  it('is silent for a script that is missing, a folder, a binary file and a script of another system', () => {
    expect(run(`${P}/hooks/none.sh`)).toEqual([])
    expect(run(`${P}/hooks`, { 'hooks/b.sh': BAD })).toEqual([])
    expect(run(`${P}/hooks/b`, { 'hooks/b': 'ELF\0\u0001' })).toEqual([])
    for (const file of ['b.ps1', 'b.bat', 'b.CMD']) {
      expect(run(`${P}/hooks/${file}`, { [`hooks/${file}`]: BAD }), file).toEqual([])
    }
  })

  it('is silent for a handler that is no shell-form command of a string', () => {
    const files = { 'hooks/b.sh': BAD }
    expect(ids(files, { type: 'http', url: 'u', command: `${P}/hooks/b.sh` })).toEqual([])
    expect(ids(files, { command: 5 })).toEqual([])
    expect(ids(files, { command: `${P}/hooks/b.sh`, shell: 'powershell' })).toEqual([])
    expect(ids(files, { command: 5, args: [] })).toEqual([])
  })

  it('reads a script when args is no array, as a command in shell form', () => {
    expect(ids({ 'hooks/b.sh': BAD }, { command: `${P}/hooks/b.sh`, args: 'x' })).toEqual([
      'shebang',
    ])
  })

  it('is silent for a script out of the repository', () => {
    const outside = repo({ 'x/b.sh': BAD })
    const text = settings(hooks('Stop', [command({ command: `${P}/link.sh` })]))
    const root = repo({ '.claude/settings.json': text })
    symlinkSync(path.join(outside, 'x/b.sh'), path.join(root, 'link.sh'))
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
  })

  it('is silent for a dangling link', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/link.sh` })]))
    const root = repo({ '.claude/settings.json': text })
    symlinkSync(path.join(root, 'gone.sh'), path.join(root, 'link.sh'))
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
  })

  it.skipIf(process.platform === 'win32')('is silent for a FIFO', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/fifo` })]))
    const root = repo({ '.claude/settings.json': text })
    execFileSync(MAKE_FIFO, [path.join(root, 'fifo')])
    expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
  })

  it.skipIf(chmodCannotBlock)('is silent for a file that it cannot read', () => {
    const text = settings(hooks('Stop', [command({ command: `${P}/hooks/b.sh` })]))
    const root = repo({ '.claude/settings.json': text, 'hooks/b.sh': BAD })
    const file = path.join(root, 'hooks/b.sh')
    withoutAccess(file, () => {
      expect(lintJson(name, text, path.join(root, '.claude/settings.json'))).toEqual([])
    })
    chmodSync(file, 0o644)
  })

  it('is silent for a file of more than one megabyte', () => {
    expect(run(`${P}/hooks/b.sh`, { 'hooks/b.sh': `echo ${'x'.repeat(1_100_000)}\n` })).toEqual([])
  })
})
