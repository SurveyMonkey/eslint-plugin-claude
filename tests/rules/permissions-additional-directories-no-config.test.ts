// A directory in `permissions.additionalDirectories` grants file access only. Claude Code loads no
// CLAUDE.md, rules, skills, commands or agents from it, with or without
// CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD
// (https://code.claude.com/docs/en/permissions#additional-directories-grant-file-access-not-configuration).
// Relative entries resolve from the directory where Claude starts
// (https://code.claude.com/docs/en/large-codebases#grant-access-across-packages-or-repositories).
// The rule reads directories of the repository only. The files glob is in tests/configs.test.ts.
import { mkdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { chmodCannotBlock, lintJson, withoutAccess } from '../rule-tester.test-support.ts'

// ADR 001, Decision 14: no call reaches a path above the repository. The recorder keeps the first
// argument of each file system call that the rule can make, while `recorded.on` is true.
const recorded = vi.hoisted(() => ({ on: false, paths: [] as string[] }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const names = [
    'realpathSync',
    'existsSync',
    'statSync',
    'lstatSync',
    'readdirSync',
    'readFileSync',
  ]
  const wrapped: Record<string, unknown> = {}
  for (const name of names) {
    const original = (actual as unknown as Record<string, (...args: unknown[]) => unknown>)[name]
    if (original === undefined) {
      continue
    }
    wrapped[name] = Object.assign(
      (file: unknown, ...rest: unknown[]) => {
        if (recorded.on) {
          recorded.paths.push(String(file))
        }
        return original(file, ...rest)
      },
      name === 'realpathSync' ? { native: actual.realpathSync.native } : {},
    )
  }
  return { ...actual, ...wrapped, default: { ...actual, ...wrapped } }
})

const onLinks = noLinks ? it.skip : it
const onChmod = chmodCannotBlock ? it.skip : it
const name = 'permissions-additional-directories-no-config'
const API = 'packages/api/.claude/settings.json'
const LOCAL = 'packages/api/.claude/settings.local.json'
const settings = (...directories: string[]) =>
  JSON.stringify({ permissions: { additionalDirectories: directories } })

const lint = (dir: string, code: string, file = API) => lintJson(name, code, path.join(dir, file))
const ids = (dir: string, code: string, file = API) =>
  lint(dir, code, file).map((message) => message.messageId)
const SHARED_CLAUDE = 'packages/shared/CLAUDE.md'

describe(`${name}: reports`, () => {
  it('reports the sibling package of the docs, which holds a CLAUDE.md', () => {
    const dir = tree({ [SHARED_CLAUDE]: '# Shared\n' })
    const messages = lint(dir, settings('../shared', '../web'))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'noConfig', line: 1 })
    expect(messages[0]?.message).toContain('"../shared"')
    expect(messages[0]?.message).toContain('CLAUDE.md')
    expect(messages[0]?.message).toContain('--add-dir')
    expect(messages[0]?.message).toContain('CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD')
  })

  for (const held of [
    'CLAUDE.md',
    'CLAUDE.local.md',
    '.claude/CLAUDE.md',
    '.claude/rules/style.md',
    '.claude/skills/s/SKILL.md',
    '.claude/commands/c.md',
    '.claude/agents/a.md',
  ]) {
    it(`reports a directory that holds ${held}`, () => {
      const dir = tree({ [`packages/shared/${held}`]: 'x\n' })
      expect(ids(dir, settings('../shared'))).toEqual(['noConfig'])
    })
  }

  it('names every item that the directory holds', () => {
    const dir = tree({
      [SHARED_CLAUDE]: 'x\n',
      'packages/shared/.claude/skills/s/SKILL.md': 'x\n',
    })
    const [message] = lint(dir, settings('../shared'))
    expect(message?.message).toContain('CLAUDE.md')
    expect(message?.message).toContain('.claude/skills')
  })

  it('reports an absolute entry that is inside the repository', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    const entry = path.join(dir, 'packages/shared')
    expect(ids(dir, settings(entry))).toEqual(['noConfig'])
    expect(ids(dir, settings(entry), LOCAL)).toEqual(['noConfig'])
  })

  it('reports each entry, at the entry', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n', 'packages/web/CLAUDE.md': 'x\n' })
    const messages = lint(
      dir,
      '{\n"permissions": {"additionalDirectories": ["../shared",\n"../web/"]}}',
    )
    expect(messages.map((message) => message.line)).toEqual([2, 3])
  })

  it('reports a folder beside the project that is not below or above it', () => {
    const dir = tree({ 'docs/CLAUDE.md': 'x\n' })
    expect(ids(dir, settings('../../docs'))).toEqual(['noConfig'])
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for a plain folder, a folder with other files, and one that is not there', () => {
    const dir = tree({
      'packages/shared/src/index.ts': 'x\n',
      'packages/docs/.claude/output-styles/o.md': 'x\n',
      'packages/docs/.claude/settings.json': '{}',
    })
    expect(ids(dir, settings('../shared', '../docs', '../missing'))).toEqual([])
  })

  it('stays silent for an entry that is a file, not a directory', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    expect(ids(dir, settings('../shared/CLAUDE.md'))).toEqual([])
  })

  it('stays silent for the project directory, a directory above it, and one below it', () => {
    const dir = tree({
      'packages/api/CLAUDE.md': 'x\n',
      'CLAUDE.md': 'x\n',
      'packages/api/sub/CLAUDE.md': 'x\n',
    })
    expect(ids(dir, settings('.', './', '..', '../..', 'sub', './sub/'))).toEqual([])
  })

  it('stays silent for a home path, a path above the repository and one out of it', () => {
    const outside = tree({ 'CLAUDE.md': 'x\n' }, false)
    const dir = tree({})
    expect(ids(dir, settings('~/shared', '../../../escape', outside))).toEqual([])
  })

  it('stays silent for an entry with a NUL byte, a Windows path and a variable', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    expect(ids(dir, settings('../shared\0', 'C:\\work\\shared', '$HOME/shared', ''))).toEqual([])
  })

  it('stays silent for a relative entry of the local file, whose start folder is unknown', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    expect(ids(dir, settings('../shared'), LOCAL)).toEqual([])
  })

  it('stays silent in a managed file, whose relative paths have no base', () => {
    const dir = tree({ 'shared/CLAUDE.md': 'x\n' })
    const absolute = path.join(dir, 'shared')
    expect(ids(dir, settings('shared', absolute), 'managed-settings.json')).toEqual([])
    expect(ids(dir, settings(absolute), 'managed-settings.d/10-a.json')).toEqual([])
  })

  it('stays silent for an entry that is not a string, a key that is not a list, or no key', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    const code = (value: unknown) =>
      JSON.stringify({ permissions: { additionalDirectories: value } })
    expect(ids(dir, code([7, null, ['../shared']]))).toEqual([])
    expect(ids(dir, code('../shared'))).toEqual([])
    expect(ids(dir, '{"permissions": {}}')).toEqual([])
    expect(ids(dir, '[1]')).toEqual([])
  })
})

describe(`${name}: a path that the rule cannot see`, () => {
  it('reads no path above the repository root, and uses no folder from there', () => {
    const outer = tree({ 'CLAUDE.md': 'x\n', 'api/CLAUDE.md': 'x\n' }, false)
    const repo = path.join(outer, 'repo')
    mkdirSync(path.join(repo, '.git'), { recursive: true })
    recorded.paths = []
    recorded.on = true
    try {
      expect(
        ids(
          outer,
          settings('../../..', '../../../api', '../../../../x'),
          'repo/packages/api/.claude/settings.json',
        ),
      ).toEqual([])
    } finally {
      recorded.on = false
    }
    const inside = (entry: string) =>
      [repo, realpathSync(repo)].some((root) => entry === root || entry.startsWith(root + path.sep))
    expect(recorded.paths.length).toBeGreaterThan(0)
    expect(recorded.paths.filter((entry) => !inside(entry))).toEqual([])
  })

  onLinks('stays silent for a link out of the repository', () => {
    const outside = tree({ 'CLAUDE.md': 'x\n' }, false)
    const dir = tree({ 'packages/api/.claude/settings.json': '{}' })
    link(dir, 'packages/shared', outside)
    expect(ids(dir, settings('../shared'))).toEqual([])
  })

  onLinks('stays silent for a link with no target', () => {
    const dir = tree({})
    link(dir, 'packages/shared', 'missing')
    expect(ids(dir, settings('../shared'))).toEqual([])
  })

  onLinks('stays silent for a .claude link that leaves the repository', () => {
    const outside = tree({ 'rules/r.md': 'x\n' }, false)
    const dir = tree({ 'packages/shared/src/a.ts': 'x\n' })
    link(dir, 'packages/shared/.claude', outside)
    expect(ids(dir, settings('../shared'))).toEqual([])
  })

  onLinks('stays silent for a CLAUDE.md that is a link with no target', () => {
    const dir = tree({ 'packages/shared/src/a.ts': 'x\n' })
    link(dir, 'packages/shared/CLAUDE.md', 'missing.md')
    expect(ids(dir, settings('../shared'))).toEqual([])
  })

  onLinks('reports a link to a directory inside the repository', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    link(dir, 'packages/alias', 'shared')
    expect(ids(dir, settings('../alias'))).toEqual(['noConfig'])
  })

  onChmod('stays silent for a directory that it cannot read', () => {
    const dir = tree({ [SHARED_CLAUDE]: 'x\n' })
    expect(ids(dir, settings('../shared'))).toEqual(['noConfig'])
    withoutAccess(path.join(dir, 'packages/shared'), () => {
      expect(ids(dir, settings('../shared'))).toEqual([])
    })
  })

  onChmod('stays silent for a .claude folder that it cannot read', () => {
    const dir = tree({
      'packages/shared/src/a.ts': 'x\n',
      'packages/shared/.claude/agents/a.md': 'x\n',
    })
    withoutAccess(path.join(dir, 'packages/shared/.claude'), () => {
      expect(ids(dir, settings('../shared'))).toEqual([])
    })
  })
})
