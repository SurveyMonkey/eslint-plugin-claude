// `docker` does not work inside the sandbox, and the docs advise an `excludedCommands` pattern
// such as `docker compose *`:
// https://code.claude.com/docs/en/sandboxing#docker-commands-fail
// The rule lints the shared project file. It reads the project folder (the one that holds
// `.claude/`) in the git index: a tracked `Dockerfile`, `docker-compose.yml` or
// `docker-compose.yaml`, or a `docker` command in a script of a tracked `package.json`. The
// repositories are real, made with `git init`.
import { symlinkSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { isolateGitConfig, plain, repo, stage } from '../git-tree.test-support.ts'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'sandbox-docker-excluded'
const PROJECT = '.claude/settings.json'
const LOCAL = '.claude/settings.local.json'
const MANAGED = 'managed-settings.json'
isolateGitConfig()
// Each case starts `git`, and a busy machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 })

const file = (fields: object) => JSON.stringify(fields)
const ON = { sandbox: { enabled: true } }
const excluding = (...entries: string[]) => ({
  sandbox: { enabled: true, excludedCommands: entries },
})
const lint = (root: string, fields: object | string, name_ = PROJECT) =>
  lintJson(name, typeof fields === 'string' ? fields : file(fields), path.join(root, name_))
const ids = (root: string, fields: object | string, name_ = PROJECT) =>
  lint(root, fields, name_).map((message) => message.messageId)
/** A repository that tracks the project settings file and `files`. */
const tracking = (files: Record<string, string> = {}) => repo({ [PROJECT]: '{}', ...files })
const DOCKERFILE = { Dockerfile: 'FROM node:22\n' }

describe(`${name}: reports`, () => {
  it('reports a tracked Dockerfile with the sandbox on and no docker entry', () => {
    expect(ids(tracking(DOCKERFILE), ON)).toEqual(['docker'])
  })

  it('reports at the value of enabled, and names the file and the advice', () => {
    const text = '{\n  "sandbox": {\n    "enabled": true\n  }\n}'
    const [message] = lint(tracking(DOCKERFILE), text)
    expect([message?.line, message?.column]).toEqual([3, 16])
    expect(message?.message).toContain('`Dockerfile`')
    expect(message?.message).toContain('`docker compose *`')
  })

  it('reports each file that shows Docker use', () => {
    const SHOWING: Record<string, string>[] = [
      { 'docker-compose.yml': 'services: {}\n' },
      { 'docker-compose.yaml': 'services: {}\n' },
      { 'package.json': file({ scripts: { up: 'docker compose up -d' } }) },
      { 'package.json': file({ scripts: { up: 'npm ci && docker build .' } }) },
      { 'package.json': file({ scripts: { up: 'docker-compose up' } }) },
      { 'package.json': file({ scripts: { up: 'docker' } }) },
      { 'package.json': file({ scripts: { up: 'sh -c "docker build ."' } }) },
      { 'package.json': file({ scripts: { up: "bash -c 'docker ps'" } }) },
      { 'package.json': file({ scripts: { up: 'sudo docker ps' } }) },
      { 'package.json': file({ scripts: { up: 'npm test; docker ps' } }) },
      { 'package.json': file({ scripts: { up: 'cat x | docker load' } }) },
      { 'package.json': file({ scripts: { up: '(docker ps)' } }) },
    ]
    for (const tracked of SHOWING) {
      expect(ids(tracking(tracked), ON), JSON.stringify(tracked)).toEqual(['docker'])
    }
  })

  it('reports when excludedCommands holds other entries', () => {
    expect(ids(tracking(DOCKERFILE), excluding('gh *', 'npm run *'))).toEqual(['docker'])
  })

  it('reports at the file when the sandbox is on in the other project file only', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: file(ON), ...DOCKERFILE })
    const [message] = lint(root, '{}')
    expect([message?.messageId, message?.line, message?.column]).toEqual(['docker', 1, 1])
    expect(lint(root, '{"sandbox": {}}')[0]).toMatchObject({ line: 1, column: 1 })
  })
})

describe(`${name}: silent`, () => {
  it('is silent when a docker entry is in the source, in any form', () => {
    for (const entry of ['docker *', 'docker compose *', 'docker', 'docker-compose *', '*']) {
      expect(ids(tracking(DOCKERFILE), excluding(entry)), entry).toEqual([])
    }
  })

  it('is silent when the other project file holds the entry', () => {
    const root = repo({
      [PROJECT]: '{}',
      [LOCAL]: file({ sandbox: { excludedCommands: ['docker compose *'] } }),
      ...DOCKERFILE,
    })
    expect(ids(root, ON)).toEqual([])
  })

  it('reports an entry that only looks like docker', () => {
    expect(ids(tracking(DOCKERFILE), excluding('dockerize *', 'podman *'))).toEqual(['docker'])
  })

  it('is silent when the project shows no Docker use', () => {
    expect(ids(tracking({ 'README.md': 'docker\n' }), ON)).toEqual([])
    expect(
      ids(tracking({ 'package.json': file({ scripts: { test: 'vitest', d: 'dockerless' } }) }), ON),
    ).toEqual([])
    expect(
      ids(tracking({ 'package.json': file({ name: 'a', scripts: 'docker up' }) }), ON),
    ).toEqual([])
    expect(ids(tracking({ 'package.json': file({ scripts: { up: 5 } }) }), ON)).toEqual([])
  })

  it('is silent for a Dockerfile that git does not track, or one in a folder below', () => {
    const untracked = repo({ [PROJECT]: '{}' }, [], DOCKERFILE)
    expect(ids(untracked, ON)).toEqual([])
    expect(ids(tracking({ 'docker/Dockerfile': 'FROM x\n' }), ON)).toEqual([])
  })

  it('is silent for a script that names a docker folder as an argument', () => {
    for (const up of [
      'cd docker && npm test',
      'ls docker',
      'echo docker-compose',
      'npm run docker',
    ]) {
      const tracked = { 'package.json': file({ scripts: { up } }) }
      expect(ids(tracking(tracked), ON), up).toEqual([])
    }
  })

  it('reads the folder that holds .claude, not the top of the repository', () => {
    const sub = 'apps/web/.claude/settings.json'
    const rooted = repo({ [sub]: '{}', ...DOCKERFILE })
    expect(ids(rooted, ON, sub)).toEqual([])
    const inside = repo({ [sub]: '{}', 'apps/web/Dockerfile': 'FROM x\n' })
    expect(ids(inside, ON, sub)).toEqual(['docker'])
    const script = { scripts: { up: 'docker compose up' } }
    const rootScript = repo({ [sub]: '{}', 'package.json': file(script) })
    expect(ids(rootScript, ON, sub)).toEqual([])
    const subScript = repo({ [sub]: '{}', 'apps/web/package.json': file(script) })
    expect(ids(subScript, ON, sub)).toEqual(['docker'])
  })

  it('is silent when a tracked package.json is a link to a file outside the repository', () => {
    const outside = plain({ 'out/package.json': file({ scripts: { up: 'docker compose up' } }) })
    const root = plain({ [PROJECT]: '{}' })
    symlinkSync(path.join(outside, 'out/package.json'), path.join(root, 'package.json'))
    stage(root, [PROJECT])
    expect(ids(root, ON)).toEqual([])
  })

  it('is silent for a script that only ends in the name, or a scripts value of another type', () => {
    const scripts = (value: unknown) => ({ 'package.json': file({ scripts: value }) })
    expect(ids(tracking(scripts({ up: 'mydocker up' })), ON)).toEqual([])
    expect(ids(tracking(scripts(['docker compose up'])), ON)).toEqual([])
    expect(ids(tracking(scripts({ up: ['docker compose up'] })), ON)).toEqual([])
    expect(ids(tracking(scripts('docker compose up')), ON)).toEqual([])
  })

  it('reports an empty entry as no docker entry', () => {
    expect(ids(tracking(DOCKERFILE), excluding('', '  '))).toEqual(['docker'])
  })

  it('is silent for a project file that is not an object, even when the other file enables', () => {
    const root = repo({ [PROJECT]: '[1]', [LOCAL]: file(ON), ...DOCKERFILE })
    expect(ids(root, '[1]')).toEqual([])
  })

  it('reports at the file, not at an enabled value that is not true, when the other file enables', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: file(ON), ...DOCKERFILE })
    const [message] = lint(root, '{"sandbox": {"enabled": null}}')
    expect([message?.line, message?.column]).toEqual([1, 1])
  })

  it('is silent when package.json does not read as an object', () => {
    for (const text of ['{', '[1]', 'null']) {
      expect(ids(tracking({ 'package.json': text }), ON), text).toEqual([])
    }
  })

  it('is silent when the sandbox is off, unset or not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(ids(tracking(DOCKERFILE), { sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(ids(tracking(DOCKERFILE), {})).toEqual([])
    expect(ids(tracking(DOCKERFILE), '[1]')).toEqual([])
  })

  it('is silent when the other project file turns the sandbox off', () => {
    const root = repo({
      [PROJECT]: '{}',
      [LOCAL]: file({ sandbox: { enabled: false } }),
      ...DOCKERFILE,
    })
    expect(ids(root, ON)).toEqual([])
  })

  it('is silent when the other project file does not read', () => {
    for (const text of ['[1]', '{']) {
      const root = repo({ [PROJECT]: '{}', [LOCAL]: text, ...DOCKERFILE })
      expect(ids(root, ON), text).toEqual([])
    }
  })

  it('lints the shared file only, not the local or a managed file', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}', [MANAGED]: '{}', ...DOCKERFILE })
    expect(ids(root, ON, LOCAL)).toEqual([])
    expect(ids(root, ON, MANAGED)).toEqual([])
    expect(ids(root, ON, 'managed-settings.d/10-a.json')).toEqual([])
  })

  it('is silent with no .git, or when the folder is not the repository', () => {
    expect(ids(plain({ [PROJECT]: '{}', ...DOCKERFILE }), ON)).toEqual([])
  })
})
