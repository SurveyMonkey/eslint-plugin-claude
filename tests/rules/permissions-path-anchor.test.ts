// A single slash in a Read or Edit rule anchors at the settings source, not at the file system
// root. A sandbox path with a single slash is absolute, so a project path that needs `./` is a
// choice of the plugin: https://code.claude.com/docs/en/permissions#read-and-edit and
// https://code.claude.com/docs/en/settings-reference#sandbox-path-prefixes
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-path-anchor'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const deny = (...rules: string[]) => ({ permissions: { deny: rules } })
const sandbox = (fields: object) => ({ sandbox: { filesystem: fields } })

describe(`${name}: a permission rule`, () => {
  it('reports the example of the task, in a project, local or managed file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(deny('Read(/Users/me/x)'), file), file).toEqual(['singleSlash'])
    }
  })

  it('reports Read, Edit and Cd, in each list', () => {
    expect(
      ids({
        permissions: {
          allow: ['Edit(/home/me/x/**)'],
          ask: ['Cd(/tmp/work)'],
          deny: ['Read(/etc/passwd)'],
        },
      }),
    ).toEqual(['singleSlash', 'singleSlash', 'singleSlash'])
  })

  it('names the rule, and gives the rule with two slashes', () => {
    const [message] = lint(deny('Read(/Users/me/x)'))
    expect(message?.message).toContain('`Read(/Users/me/x)`')
    expect(message?.message).toContain('`Read(//Users/me/x)`')
  })

  it('gives a fix with two slashes for each reported form', () => {
    for (const [rule, fixed] of [
      ['Read(/tmp)', 'Read(//tmp)'],
      ['Edit(/var/log/**)', 'Edit(//var/log/**)'],
      ['Read( /Users/me/*.pdf )', 'Read(//Users/me/*.pdf)'],
    ] as const) {
      expect(lint(deny(rule))[0]?.message, rule).toContain(`\`${fixed}\``)
    }
  })

  it('is silent for the other anchors, and for a project directory', () => {
    expect(
      ids(
        deny(
          'Read(//Users/me/x)',
          'Read(~/x)',
          'Read(./x)',
          'Read(x)',
          'Read(/src/**)',
          'Edit(/docs/**)',
          'Read(/users/me)',
          'Read(!/Users/me)',
        ),
      ),
    ).toEqual([])
  })

  it('is silent for a tool with no path, a bare tool, a parameter rule and a drive letter', () => {
    expect(ids(deny('Bash(/tmp/x)', 'Read', 'Read(offset:5)', 'Read(C:\\Users\\me)'))).toEqual([])
  })

  it('is silent for a rule that does not parse, and in a hidden drop-in', () => {
    expect(ids(deny('Read(/tmp/x'))).toEqual([])
    expect(ids(deny('Read(/tmp/x)'), HIDDEN)).toEqual([])
  })

  it('reports the entry, at its line and column', () => {
    const [message] = lint(JSON.stringify(deny('Read(/tmp/x)')))
    expect([message?.line, message?.column, message?.endLine, message?.endColumn]).toEqual([
      1, 25, 1, 39,
    ])
  })
})

describe(`${name}: a sandbox path`, () => {
  it('reports a single-slash path that is no file system root, in a project or local file', () => {
    for (const file of [PROJECT, LOCAL]) {
      expect(ids(sandbox({ allowWrite: ['/output'] }), file), file).toEqual(['sandboxSlash'])
    }
  })

  it('reads the four lists', () => {
    expect(
      ids(
        sandbox({
          allowWrite: ['/a'],
          denyWrite: ['/b'],
          denyRead: ['/c/d'],
          allowRead: ['/e'],
        }),
      ),
    ).toEqual(['sandboxSlash', 'sandboxSlash', 'sandboxSlash', 'sandboxSlash'])
  })

  it('names the path, and gives the path with ./', () => {
    const [message] = lint(sandbox({ allowWrite: ['/output/cache'] }))
    expect(message?.message).toContain('"/output/cache"')
    expect(message?.message).toContain('"./output/cache"')
  })

  it('is silent for a path in the file system roots, and the other prefixes', () => {
    expect(
      ids(
        sandbox({
          allowWrite: ['/tmp/build', '//output', '~/x', './x', 'x', '/Users/me/x'],
          denyRead: ['/'],
        }),
      ),
    ).toEqual([])
  })

  it('is silent in a managed file: the docs give the single slash no project meaning there', () => {
    expect(ids(sandbox({ allowWrite: ['/output'] }), MANAGED)).toEqual([])
    expect(ids(sandbox({ allowWrite: ['/output'] }), DROP_IN)).toEqual([])
  })

  it('is silent for an entry that is no string, a list that is no array, and a wrong shape', () => {
    expect(ids(sandbox({ allowWrite: [1, null, { path: '/output' }] }))).toEqual([])
    expect(ids(sandbox({ allowWrite: '/output' }))).toEqual([])
    expect(ids({ sandbox: { filesystem: [1] } })).toEqual([])
    expect(ids('{}')).toEqual([])
  })

  it('is silent in a hidden drop-in', () => {
    expect(ids(sandbox({ allowWrite: ['/output'] }), HIDDEN)).toEqual([])
  })
})
