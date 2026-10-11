// A directory pattern that ends in `/**/*` covers everything inside the directory and not the
// directory itself, so Claude can still list it. A pattern that ends in `/**` covers the directory
// too. The docs give this advice for build output and vendored code
// (https://code.claude.com/docs/en/large-codebases#block-reads-of-generated-and-vendored-code).
// The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintJson } from '../rule-tester.test-support.ts'

const name = 'permissions-deny-dir-listable'
const PROJECT = '/repo/.claude/settings.json'
const LOCAL = '/repo/.claude/settings.local.json'
const MANAGED = '/repo/managed-settings.json'
const DROP_IN = '/repo/managed-settings.d/10-a.json'
const HIDDEN = '/repo/managed-settings.d/.10-a.json'

const lint = (code: unknown, file = PROJECT) =>
  lintJson(name, typeof code === 'string' ? code : JSON.stringify(code), file)
const ids = (code: unknown, file = PROJECT) => lint(code, file).map((message) => message.messageId)
const deny = (...rules: string[]) => ({ permissions: { deny: rules } })

describe(`${name}: reports`, () => {
  it('reports the build directory of the docs, in a project, local or managed file', () => {
    for (const file of [PROJECT, LOCAL, MANAGED, DROP_IN]) {
      expect(ids(deny('Read(./build/**)'), file), file).toEqual(['listable'])
    }
  })

  it('reports each directory name of the docs example, in each pattern form', () => {
    const rules = [
      'Read(./dist/**)',
      'Read(vendor/**)',
      'Read(/build/**)',
      'Read(./**/vendor/**)',
      'Read(**/dist/**)',
      'Read(//opt/app/build/**)',
      'Read(~/work/vendor/**)',
      'Read(./packages/api/dist/**)',
    ]
    expect(ids(deny(...rules))).toEqual(rules.map(() => 'listable'))
  })

  it('names the rule and gives the rule that keeps the directory listable', () => {
    const [message] = lint(deny('Read(./**/dist/**)'))
    expect(message).toMatchObject({ line: 1 })
    expect(message?.message).toContain('`Read(./**/dist/**)`')
    expect(message?.message).toContain('`Read(./**/dist/**/*)`')
  })

  it('gives a replacement that appends /* for each reported form', () => {
    for (const rule of ['./build/**', 'vendor/**', '//opt/dist/**', '~/x/build/**']) {
      const [message] = lint(deny(`Read(${rule})`))
      expect(message?.message, rule).toContain(`\`Read(${rule}/*)\``)
    }
  })
})

describe(`${name}: silent`, () => {
  it('stays silent for the form that the docs give', () => {
    const rules = [
      'Read(./**/dist/**/*)',
      'Read(./**/build/**/*)',
      'Read(./**/*.generated.*)',
      'Read(./**/vendor/**/*)',
    ]
    expect(ids(deny(...rules))).toEqual([])
  })

  it('stays silent for a directory that the docs do not name, and for secrets', () => {
    expect(
      ids(deny('Read(./secrets/**)', 'Read(./src/gen/**)', 'Read(./node_modules/**)')),
    ).toEqual([])
  })

  it('stays silent for a name that only ends in a listed name', () => {
    expect(ids(deny('Read(./rebuild/**)', 'Read(./my-dist/**)', 'Read(./build2/**)'))).toEqual([])
  })

  it('stays silent for a pattern that is not a directory rule', () => {
    const rules = [
      'Read(**)',
      'Read(/**)',
      'Read(./build)',
      'Read(./build/)',
      'Read(./build/*)',
      'Read(./build/**/*.js)',
      'Read(!./build/**)',
      'Read(./build/**/x)',
      'Read',
      'Read()',
      'Read(offset:5)',
    ]
    expect(ids(deny(...rules))).toEqual([])
  })

  it('stays silent for an allow rule, an ask rule and a tool that is not Read', () => {
    const code = {
      permissions: {
        allow: ['Read(./build/**)'],
        ask: ['Read(./dist/**)'],
        deny: ['Edit(./build/**)', 'Grep(./dist/**)', 'Bash(./vendor/**)'],
      },
    }
    expect(ids(code)).toEqual([])
  })

  it('stays silent in a hidden drop-in, with no rules, and with a file that is no object', () => {
    expect(ids(deny('Read(./build/**)'), HIDDEN)).toEqual([])
    expect(ids('{}')).toEqual([])
    expect(ids('[1]')).toEqual([])
  })
})
