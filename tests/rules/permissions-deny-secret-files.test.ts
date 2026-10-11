// A tracked `.env`, `.env.*` file or `secrets/` folder with no `Read` deny rule is open to Claude.
// The docs name `.env`, `.env.*` and `secrets/` in the example of `permissions.deny`
// (https://code.claude.com/docs/en/settings-reference#permissions-deny). The repositories are
// real, made with `git init`, because the rule asks the git index. The files glob is in
// tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { isolateGitConfig, plain, repo } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-deny-secret-files'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const deny = (...rules: string[]) => JSON.stringify({ permissions: { deny: rules } })
const lint = (root: string, code: string, file = PROJECT) =>
  lintJson(name, code, path.join(root, file))
const ids = (root: string, code: string, file = PROJECT) =>
  lint(root, code, file).map((message) => message.messageId)
/** A repository that tracks `files`, and the project settings file. */
const tracking = (...files: string[]) =>
  repo({ [PROJECT]: '{}', ...Object.fromEntries(files.map((file) => [file, 'KEY=1\n'])) })

describe(`${name}: reports`, () => {
  it('reports a tracked .env with no deny rule, at the permissions block or the file', () => {
    const root = tracking('.env')
    const messages = lint(root, '{}')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ messageId: 'open', line: 1, column: 1 })
    expect(messages[0]?.message).toContain('`.env`')
    expect(messages[0]?.message).toContain('`Read(./.env)`')
  })

  it('reports at the permissions value when the file has one', () => {
    const [message] = lint(tracking('.env'), '{\n  "permissions": {\n    "allow": []\n  }\n}')
    expect(message).toMatchObject({ line: 2 })
  })

  it('reports a tracked .env.local, a tracked secrets folder, and gives the rule for each', () => {
    const root = tracking('.env.local', 'secrets/key.pem')
    const [message] = lint(root, '{}')
    expect(message?.message).toContain('`.env.local`')
    expect(message?.message).toContain('`secrets/`')
    expect(message?.message).toContain('`Read(./.env.*)`')
    expect(message?.message).toContain('`Read(./secrets/**)`')
    expect(message?.message).not.toContain('`Read(./.env)`')
  })

  it('names every uncovered item in one report', () => {
    const root = tracking('.env', '.env.production', 'secrets/a/b.txt')
    const messages = lint(root, '{}')
    expect(messages).toHaveLength(1)
    for (const item of ['`.env`', '`.env.production`', '`secrets/`']) {
      expect(messages[0]?.message).toContain(item)
    }
  })

  it('reports the part that no rule covers', () => {
    const root = tracking('.env', 'secrets/key.pem')
    const [message] = lint(root, deny('Read(./.env)'))
    expect(message?.message).toContain('`secrets/`')
    expect(message?.message).not.toContain('`.env`')
  })

  it('reports a deny rule that covers other files, and rules that are not Read deny rules', () => {
    const root = tracking('.env')
    const code = JSON.stringify({
      permissions: {
        allow: ['Read(./.env)'],
        ask: ['Read(./.env)'],
        deny: [
          'Read(./src/.env)',
          'Edit(./.env)',
          'Read(//etc/.env)',
          'Read(~/.env)',
          'Read(offset:5)',
          'Read(./)',
          'Read(/)',
          'Read(!./.env)',
          'Read(//.env)',
          'Edit',
          'Bash',
          'WebFetch(domain:a.test)',
        ],
      },
    })
    expect(ids(root, code)).toEqual(['open'])
  })

  it('reports a secrets folder that a pattern of another shape does not cover', () => {
    // `?` and `*` stay in one part of the path, so none of these covers `secrets/k`.
    for (const rule of [
      'Read(secrets?k)',
      'Read(secrets*k)',
      'Read(secrets?x)',
      'Read(secrets*x)',
    ]) {
      expect(ids(tracking('secrets/k'), deny(rule)), rule).toEqual(['open'])
    }
  })

  it('reports a .env that a pattern of another shape does not cover', () => {
    for (const rule of [
      'Read(**/env)',
      'Read(./.en)',
      'Read(.env/**)',
      'Read(env)',
      'Read(./Xenv)',
    ]) {
      expect(ids(tracking('.env'), deny(rule)), rule).toEqual(['open'])
    }
  })

  it('reports a project below the root for the files of that project only', () => {
    const root = repo({
      'packages/a/.claude/settings.json': '{}',
      'packages/a/.env': 'K=1\n',
      '.env': 'K=1\n',
    })
    const messages = lint(root, '{}', 'packages/a/.claude/settings.json')
    expect(messages).toHaveLength(1)
    const rootOnly = repo({ 'packages/a/.claude/settings.json': '{}', '.env': 'K=1\n' })
    expect(ids(rootOnly, '{}', 'packages/a/.claude/settings.json')).toEqual([])
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for the deny list of the docs example', () => {
    const root = tracking('.env', '.env.local', 'secrets/key.pem')
    expect(ids(root, deny('Read(./.env)', 'Read(./.env.*)', 'Read(./secrets/**)'))).toEqual([])
  })

  it('stays silent for each other form that covers a file', () => {
    const forms: [string[], string[]][] = [
      [['Read(.env)'], ['.env']],
      [['Read(**/.env)'], ['.env']],
      [['Read(/.env)'], ['.env']],
      [['Read(*.env)'], ['.env']],
      [['Read(**/.env*)'], ['.env', '.env.local']],
      [['Read(.env*)'], ['.env', '.env.local']],
      [['Read(./.env.l?cal)'], ['.env.local']],
      [['Read(./.en[v])'], ['.env']],
      [['Read(secrets)'], ['secrets/k']],
      [['Read(secrets/)'], ['secrets/k']],
      [['Read(/secrets/**)'], ['secrets/k']],
      [['Read(**/secrets/**)'], ['secrets/k']],
      [['Read(./secrets/**/*)'], ['secrets/k']],
      [['Read'], ['.env', 'secrets/k']],
      [['Read(*)'], ['.env', 'secrets/k']],
      [['Read(**)'], ['.env', 'secrets/k']],
    ]
    for (const [rules, files] of forms) {
      expect(ids(tracking(...files), deny(...rules)), rules.join()).toEqual([])
    }
  })

  it('stays silent when the local file holds the deny rule', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: deny('Read(./.env)'), '.env': 'K=1\n' })
    expect(ids(root, '{}')).toEqual([])
  })

  it('stays silent for a file that git does not track, and for one that is not there', () => {
    const loose = repo({ [PROJECT]: '{}' }, [], { '.env': 'K=1\n', 'secrets/key.pem': 'x\n' })
    expect(ids(loose, '{}')).toEqual([])
    expect(ids(repo({ [PROJECT]: '{}' }), '{}')).toEqual([])
  })

  it('stays silent for placeholder files, and for names that only look alike', () => {
    const root = tracking(
      '.env.example',
      '.env.sample',
      '.env.template',
      '.envrc',
      '.environment',
      '.env-local',
      'env',
      'secrets',
      'secret/key',
      'apps/web/.env',
      'apps/secrets/key',
    )
    expect(ids(root, '{}')).toEqual([])
  })

  it('stays silent when git cannot answer: no repository', () => {
    const root = plain({ [PROJECT]: '{}', '.env': 'K=1\n' })
    expect(ids(root, '{}')).toEqual([])
  })

  it('stays silent when the other project file cannot be read', () => {
    for (const other of ['[1]', '{']) {
      const root = repo({ [PROJECT]: '{}', [LOCAL]: other, '.env': 'K=1\n' })
      expect(ids(root, '{}'), other).toEqual([])
    }
  })

  it('stays silent in the local file and in a managed file', () => {
    const root = repo({ [PROJECT]: '{}', '.env': 'K=1\n', 'managed-settings.json': '{}' })
    expect(ids(root, '{}', LOCAL)).toEqual([])
    expect(ids(root, '{}', 'managed-settings.json')).toEqual([])
    expect(ids(root, '{}', 'managed-settings.d/10-a.json')).toEqual([])
  })

  it('stays silent for a file that is no object', () => {
    expect(ids(tracking('.env'), '[1]')).toEqual([])
  })
})
