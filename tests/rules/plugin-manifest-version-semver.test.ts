// The `version` of `plugin.json`, when set, is a semantic version. Claude Code does not check it,
// and `claude plugin validate` does not either. A dependency range and a `<name>--v<version>`
// release tag need it. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-manifest-version-semver'
const check = it.fails
const linked = noLinks ? it.skip : check

const message = (version: string) =>
  `The \`version\` "${version}" is not a semantic version such as 1.2.3. A dependency range and a release tag need one.`
const run = (text: string) => {
  const { dir, code } = pluginTree(text)
  return lintPlugin(RULE, dir, code)
}
const manifest = (version: unknown) => JSON.stringify({ name: 'p', version })

describe(RULE, () => {
  check('reports a version with two numbers, with the full message and the position', () => {
    const found = run('{"name": "p", "version": "1.0"}')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'notSemver',
      message: message('1.0'),
      line: 1,
      column: 26,
      endLine: 1,
      endColumn: 31,
    })
  })

  check.each([
    ['one number', '1'],
    ['two numbers', '1.0'],
    ['four numbers', '1.0.0.0'],
    ['a leading v', 'v1.0.0'],
    ['a leading zero', '01.0.0'],
    ['a leading zero in the patch', '1.0.01'],
    ['a word', 'latest'],
    ['a range', '^1.0.0'],
    ['an empty text', ''],
    ['a space', '1.0.0 '],
    ['an empty prerelease', '1.0.0-'],
    ['an empty build', '1.0.0+'],
    ['a leading zero in a numeric prerelease', '1.0.0-01'],
    ['an empty prerelease part', '1.0.0-a..b'],
    ['a character that is not allowed in a prerelease', '1.0.0-a_b'],
    ['a minus sign in the core', '-1.0.0'],
  ])('reports %s', (_title, version) => {
    expect(run(manifest(version)).map((m) => m.message)).toEqual([message(version)])
  })

  check('reports the last of two version keys, as Claude Code reads it', () => {
    expect(
      run('{"name": "p", "version": "1.0.0", "version": "1.0"}').map((m) => m.message),
    ).toEqual([message('1.0')])
  })

  check('reports in a plugin below the repository root', () => {
    const { dir, code } = pluginTree(manifest('1.0'), {}, 'plugins/p/')
    expect(lintPlugin(RULE, dir, code).map((m) => m.messageId)).toEqual(['notSemver'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['a plain version', '1.0.0'],
    ['zeros', '0.0.0'],
    ['large numbers', '10.20.30'],
    ['a prerelease', '1.0.0-beta'],
    ['a prerelease with a dot', '1.0.0-beta.1'],
    ['a numeric prerelease', '1.0.0-0'],
    ['a hyphen in a prerelease', '1.0.0-x-y-z.--'],
    ['build metadata', '1.0.0+20130313144700'],
    ['build metadata with a leading zero', '1.0.0+001'],
    ['a prerelease and build metadata', '1.0.0-rc.1+sha.5114f85'],
  ])('stays silent for %s', (_title, version) => {
    expect(run(manifest(version))).toEqual([])
  })

  check.each([
    ['no version', '{"name": "p"}'],
    ['a number', '{"name": "p", "version": 1}'],
    ['null', '{"name": "p", "version": null}'],
    ['an array', '{"name": "p", "version": ["1.0"]}'],
    ['an object', '{"name": "p", "version": {}}'],
    ['a version in a nested object', '{"name": "p", "metadata": {"version": "1.0"}}'],
    ['a valid last version key', '{"name": "p", "version": "1.0", "version": "1.0.0"}'],
  ])('stays silent for %s', (_title, text) => {
    expect(run(text)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, manifest('1.0'))).toEqual([])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ '.claude-plugin/plugin.json': manifest('1.0') }, false)
    const top = tree({})
    link(top, 'plugins/p', elsewhere)
    expect(lintPlugin(RULE, `${top}/plugins/p`, manifest('1.0'))).toEqual([])
  })
})
