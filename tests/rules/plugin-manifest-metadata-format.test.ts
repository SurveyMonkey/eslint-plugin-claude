// The `license` of `plugin.json` is an SPDX license expression, and the `repository` is a URL.
// Claude Code and `claude plugin validate` check neither. The cases use identifiers that are
// in the SPDX License List (https://spdx.org/licenses/). The rule checks each name in the
// expression against the list, and not the shape of the expression. The files glob is in
// tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-manifest-metadata-format'
const check = it
const linked = noLinks ? it.skip : check

const licenseMessage = (license: string) =>
  `The \`license\` "${license}" is not an SPDX license expression. Use an identifier from https://spdx.org/licenses/, such as MIT or Apache-2.0.`
const repositoryMessage = (repository: string) =>
  `The \`repository\` "${repository}" is not a URL. Use the URL of the source repository, such as https://github.com/acme/tool.`
const run = (fields: Record<string, unknown>, at = '') => {
  const { dir, code } = pluginTree({ name: 'p', ...fields }, {}, at)
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports a license that is not SPDX, with the full message and the position', () => {
    const found = run({ license: 'bogus' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'license',
      message: licenseMessage('bogus'),
      line: 1,
      column: 23,
      endLine: 1,
      endColumn: 30,
    })
  })

  check('reports a repository that is not a URL, with the full message and the position', () => {
    const found = run({ repository: 'nope' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'repository',
      message: repositoryMessage('nope'),
      line: 1,
      column: 26,
      endLine: 1,
      endColumn: 32,
    })
  })

  check.each([
    ['a word', 'bogus'],
    ['an empty text', ''],
    ['spaces only', '   '],
    ['an npm placeholder', 'UNLICENSED'],
    ['an npm file reference', 'SEE LICENSE IN LICENSE.txt'],
    ['a name with a typo', 'Apache-2'],
    ['a name that is not a license', 'MIT-license'],
    ['an unknown name in an expression', 'MIT OR bogus'],
    ['an unknown name in parentheses', '(MIT OR bogus)'],
    ['a lowercase operator', 'MIT or ISC'],
    ['an unknown exception', 'GPL-2.0-only WITH bogus'],
    ['a license name as an exception', 'GPL-2.0-only WITH MIT'],
    ['an exception name as a license', 'Classpath-exception-2.0'],
    ['a plus sign alone', '+'],
    ['two plus signs', 'MIT++'],
    ['a plus sign after a space', 'MIT +'],
    ['operators and no name', 'AND OR'],
    ['a reference with no name', 'LicenseRef-'],
    ['a reference with a bad character', 'LicenseRef-a_b'],
    ['a document reference with no license reference', 'DocumentRef-x:MIT'],
  ])('reports %s', (_title, license) => {
    expect(run({ license }).map((m) => m.message)).toEqual([licenseMessage(license)])
  })

  check.each([
    ['a word', 'nope'],
    ['an owner and a name', 'acme/tool'],
    ['an scp address', 'git@github.com:acme/tool.git'],
    ['an empty text', ''],
    ['a host with no scheme', 'github.com/acme/tool'],
  ])('reports a repository that is %s', (_title, repository) => {
    expect(run({ repository }).map((m) => m.message)).toEqual([repositoryMessage(repository)])
  })

  check('reports both fields in the order of the manifest', () => {
    expect(run({ repository: 'x', license: 'y' }).map((m) => m.messageId)).toEqual([
      'repository',
      'license',
    ])
  })

  check('reports the last of two license keys, as Claude Code reads it', () => {
    const { dir } = pluginTree('{}')
    const code = '{"name": "p", "license": "MIT", "license": "bogus"}'
    expect(lintPlugin(RULE, dir, code).map((m) => m.message)).toEqual([licenseMessage('bogus')])
  })

  check('reports in a plugin below the repository root', () => {
    expect(run({ license: 'bogus' }, 'plugins/p/').map((m) => m.messageId)).toEqual(['license'])
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['an identifier', 'MIT'],
    ['an identifier with digits and dots', 'Apache-2.0'],
    ['a lowercase identifier', 'mit'],
    ['a mixed-case identifier', 'apache-2.0'],
    ['an identifier with a plus sign', 'GPL-2.0+'],
    ['a deprecated identifier', 'GPL-2.0'],
    ['an identifier that holds a hyphen and a word', 'BSD-3-Clause'],
    ['a choice', 'MIT OR Apache-2.0'],
    ['a pair', 'MIT AND BSD-2-Clause'],
    ['a choice in parentheses', '(MIT OR Apache-2.0)'],
    ['a nest of parentheses', 'MIT AND (Apache-2.0 OR (BSD-2-Clause OR ISC))'],
    ['parentheses with no spaces', '(MIT OR(ISC))'],
    ['spaces around the text', ' MIT '],
    ['an exception', 'GPL-2.0-only WITH Classpath-exception-2.0'],
    ['a lowercase exception', 'GPL-2.0-only WITH classpath-exception-2.0'],
    ['a license reference', 'LicenseRef-Proprietary'],
    ['a license reference with dots and hyphens', 'LicenseRef-Acme.Internal-1'],
    ['a document reference', 'DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2'],
  ])('stays silent for %s', (_title, license) => {
    expect(run({ license })).toEqual([])
  })

  check.each([
    ['an https URL', 'https://github.com/acme/tool'],
    ['an https URL with a git suffix', 'https://github.com/acme/tool.git'],
    ['a git URL', 'git://github.com/acme/tool.git'],
    ['a git+https URL', 'git+https://github.com/acme/tool.git'],
    ['an ssh URL', 'ssh://git@github.com/acme/tool.git'],
  ])('stays silent for a repository that is %s', (_title, repository) => {
    expect(run({ repository })).toEqual([])
  })

  check.each([
    ['no license and no repository', {}],
    ['a license that is a number', { license: 5 }],
    ['a license that is null', { license: null }],
    ['a license that is an object', { license: { type: 'MIT' } }],
    ['a repository that is an object', { repository: { url: 'nope' } }],
    ['a repository that is an array', { repository: ['nope'] }],
    ['a homepage that is not a URL, which is for claude plugin validate', { homepage: 'nope' }],
    ['a license in a nested object', { metadata: { license: 'bogus', repository: 'nope' } }],
  ])('stays silent for %s', (_title, fields) => {
    expect(run(fields)).toEqual([])
  })

  check('stays silent for a manifest that does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, '{"name": "p", "license": "bogus"}')).toEqual([])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ '.claude-plugin/plugin.json': '{"name": "p"}' }, false)
    const top = tree({})
    link(top, 'plugins/p', elsewhere)
    expect(
      lintPlugin(RULE, `${top}/plugins/p`, '{"name": "p", "license": "bogus", "repository": "x"}'),
    ).toEqual([])
  })
})
