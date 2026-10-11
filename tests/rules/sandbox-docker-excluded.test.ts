// `docker` does not work inside the sandbox, and the docs advise an `excludedCommands` pattern
// such as `docker compose *`:
// https://code.claude.com/docs/en/sandboxing#docker-commands-fail
// The rule lints the shared project file. It reads the project folder (the one that holds
// `.claude/`) in the git index: a tracked `Dockerfile`, `docker-compose.yml` or
// `docker-compose.yaml`, or a `docker` command in a script of a tracked `package.json`. The
// repositories are real, made with `git init`.
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { isolateGitConfig, plain, repo } from '../git-tree.test-support.ts'
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
  it.fails('reports a tracked Dockerfile with the sandbox on and no docker entry', () => {
    expect(ids(tracking(DOCKERFILE), ON)).toEqual(['docker'])
  })

  it.fails('reports at the value of enabled, and names the file and the advice', () => {
    const text = '{\n  "sandbox": {\n    "enabled": true\n  }\n}'
    const [message] = lint(tracking(DOCKERFILE), text)
    expect([message?.line, message?.column]).toEqual([3, 16])
    expect(message?.message).toContain('`Dockerfile`')
    expect(message?.message).toContain('`docker compose *`')
  })

  it.fails('reports each file that shows Docker use', () => {
    const SHOWING: Record<string, string>[] = [
      { 'docker-compose.yml': 'services: {}\n' },
      { 'docker-compose.yaml': 'services: {}\n' },
      { 'package.json': file({ scripts: { up: 'docker compose up -d' } }) },
      { 'package.json': file({ scripts: { up: 'npm ci && docker build .' } }) },
      { 'package.json': file({ scripts: { up: 'docker-compose up' } }) },
      { 'package.json': file({ scripts: { up: 'docker' } }) },
    ]
    for (const tracked of SHOWING) {
      expect(ids(tracking(tracked), ON), JSON.stringify(tracked)).toEqual(['docker'])
    }
  })

  it.fails('reports when excludedCommands holds other entries', () => {
    expect(ids(tracking(DOCKERFILE), excluding('gh *', 'npm run *'))).toEqual(['docker'])
  })

  it.fails('reports at the file when the sandbox is on in the other project file only', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: file(ON), ...DOCKERFILE })
    const [message] = lint(root, '{}')
    expect([message?.messageId, message?.line, message?.column]).toEqual(['docker', 1, 1])
    expect(lint(root, '{"sandbox": {}}')[0]).toMatchObject({ line: 1, column: 1 })
  })
})

describe(`${name}: silent`, () => {
  it.fails('is silent when a docker entry is in the source, in any form', () => {
    for (const entry of ['docker *', 'docker compose *', 'docker', 'docker-compose *', '*']) {
      expect(ids(tracking(DOCKERFILE), excluding(entry)), entry).toEqual([])
    }
  })

  it.fails('is silent when the other project file holds the entry', () => {
    const root = repo({
      [PROJECT]: '{}',
      [LOCAL]: file({ sandbox: { excludedCommands: ['docker compose *'] } }),
      ...DOCKERFILE,
    })
    expect(ids(root, ON)).toEqual([])
  })

  it.fails('reports an entry that only looks like docker', () => {
    expect(ids(tracking(DOCKERFILE), excluding('dockerize *', 'podman *'))).toEqual(['docker'])
  })

  it.fails('is silent when the project shows no Docker use', () => {
    expect(ids(tracking({ 'README.md': 'docker\n' }), ON)).toEqual([])
    expect(
      ids(tracking({ 'package.json': file({ scripts: { test: 'vitest', d: 'dockerless' } }) }), ON),
    ).toEqual([])
    expect(
      ids(tracking({ 'package.json': file({ name: 'a', scripts: 'docker up' }) }), ON),
    ).toEqual([])
    expect(ids(tracking({ 'package.json': file({ scripts: { up: 5 } }) }), ON)).toEqual([])
  })

  it.fails('is silent for a Dockerfile that git does not track, or one in a folder below', () => {
    const untracked = repo({ [PROJECT]: '{}' }, [], DOCKERFILE)
    expect(ids(untracked, ON)).toEqual([])
    expect(ids(tracking({ 'docker/Dockerfile': 'FROM x\n' }), ON)).toEqual([])
  })

  it.fails('is silent when package.json does not read as an object', () => {
    for (const text of ['{', '[1]', 'null']) {
      expect(ids(tracking({ 'package.json': text }), ON), text).toEqual([])
    }
  })

  it.fails('is silent when the sandbox is off, unset or not true', () => {
    for (const sandbox of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: null }]) {
      expect(ids(tracking(DOCKERFILE), { sandbox }), JSON.stringify(sandbox)).toEqual([])
    }
    expect(ids(tracking(DOCKERFILE), {})).toEqual([])
    expect(ids(tracking(DOCKERFILE), '[1]')).toEqual([])
  })

  it.fails('is silent when the other project file turns the sandbox off', () => {
    const root = repo({
      [PROJECT]: '{}',
      [LOCAL]: file({ sandbox: { enabled: false } }),
      ...DOCKERFILE,
    })
    expect(ids(root, ON)).toEqual([])
  })

  it.fails('is silent when the other project file does not read', () => {
    for (const text of ['[1]', '{']) {
      const root = repo({ [PROJECT]: '{}', [LOCAL]: text, ...DOCKERFILE })
      expect(ids(root, ON), text).toEqual([])
    }
  })

  it.fails('lints the shared file only, not the local or a managed file', () => {
    const root = repo({ [PROJECT]: '{}', [LOCAL]: '{}', [MANAGED]: '{}', ...DOCKERFILE })
    expect(ids(root, ON, LOCAL)).toEqual([])
    expect(ids(root, ON, MANAGED)).toEqual([])
    expect(ids(root, ON, 'managed-settings.d/10-a.json')).toEqual([])
  })

  it.fails('is silent with no .git, or when the folder is not the repository', () => {
    expect(ids(plain({ [PROJECT]: '{}', ...DOCKERFILE }), ON)).toEqual([])
  })
})
