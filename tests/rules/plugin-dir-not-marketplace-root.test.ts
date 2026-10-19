// `--plugin-dir` takes the root of a plugin. At a marketplace root, Claude Code does not read
// `marketplace.json`, so the plugins under `plugins/` do not load and no error shows
// (troubleshooting page, "`--plugin-dir` at a marketplace root doesn't load the plugins under
// `plugins/`"). `CLAUDE_CODE_PLUGIN_DIRS` loads each directory the way the flag does, with an
// absolute path or a path from `~` (environment variables page). The rule reads the `scripts` of a
// `package.json`. It resolves a path from the folder of the file, and reads the target on disk.
// The trees are on disk. The files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPluginFile } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-dir-not-marketplace-root'
const check = it
const linked = noLinks ? it.skip : check

const message = (script: string, value: string, source = '--plugin-dir') =>
  `The script "${script}" loads "${value}" with \`${source}\`, and that folder is a marketplace root. Claude Code does not read \`marketplace.json\` there, so the plugins under \`plugins/\` do not load, and no error shows. Point \`${source}\` at the folder of a plugin.`

const MARKET = '{"name":"m","owner":{"name":"o"},"plugins":[]}'
const MANIFEST = '{"name":"p"}'
const scripts = (entries: Record<string, string>) => JSON.stringify({ scripts: entries })

/** The messages for the `package.json` at `at` (a folder below `top`) with the scripts `entries`. */
function run(
  entries: Record<string, string>,
  files: Record<string, string> = { '.claude-plugin/marketplace.json': MARKET },
  at = '',
) {
  const code = scripts(entries)
  const top = tree({ ...files, [path.join(at, 'package.json')]: code })
  return lintPluginFile(RULE, ['**/package.json'], path.join(top, at, 'package.json'), code)
}
const texts = (found: { message: string }[]) => found.map((m) => m.message)

describe(RULE, () => {
  check('reports a dot at a marketplace root, with the full message and the location', () => {
    const code = scripts({ dev: 'claude --plugin-dir .' })
    const top = tree({ '.claude-plugin/marketplace.json': MARKET })
    const found = lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'marketplaceRoot',
      message: message('dev', '.'),
      line: 1,
      column: code.indexOf('"claude --plugin-dir ."') + 1,
    })
  })

  check.each([
    ['a path with a slash', 'claude --plugin-dir ./'],
    ['the equals form', 'claude --plugin-dir=.'],
    ['a quoted path', 'claude --plugin-dir "."'],
    ['a flag after other flags', 'claude --model opus --plugin-dir . -p hi'],
    ['a path after other commands', 'echo hi && claude --plugin-dir .'],
  ])('reports %s', (_title, command) => {
    expect(run({ dev: command })).toHaveLength(1)
  })

  check('reports a folder below the package folder', () => {
    const files = {
      '.claude-plugin/marketplace.json': MARKET,
      'mk/.claude-plugin/marketplace.json': MARKET,
    }
    expect(texts(run({ dev: 'claude --plugin-dir ./mk' }, files))).toEqual([message('dev', './mk')])
  })

  check('resolves a path from the folder of the package.json', () => {
    const files = { '.claude-plugin/marketplace.json': MARKET }
    expect(texts(run({ dev: 'claude --plugin-dir ../..' }, files, 'a/b'))).toEqual([
      message('dev', '../..'),
    ])
  })

  check('reports each flag of a script and each script', () => {
    const found = run({
      a: 'claude --plugin-dir . --plugin-dir ./',
      b: 'claude --plugin-dir .',
    })
    expect(texts(found)).toEqual([message('a', '.'), message('a', './'), message('b', '.')])
  })

  check('reports an absolute path of CLAUDE_CODE_PLUGIN_DIRS inside the repository', () => {
    const top = tree({ '.claude-plugin/marketplace.json': MARKET })
    const code = scripts({ dev: `CLAUDE_CODE_PLUGIN_DIRS=${top} claude` })
    const found = lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)
    expect(texts(found)).toEqual([message('dev', top, 'CLAUDE_CODE_PLUGIN_DIRS')])
  })

  check('reads each path of a list in CLAUDE_CODE_PLUGIN_DIRS', () => {
    const top = tree({
      '.claude-plugin/marketplace.json': MARKET,
      'p/.claude-plugin/plugin.json': MANIFEST,
    })
    const code = scripts({ dev: `CLAUDE_CODE_PLUGIN_DIRS="${top}/p:${top}:/elsewhere" claude` })
    const found = lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)
    expect(texts(found)).toEqual([message('dev', top, 'CLAUDE_CODE_PLUGIN_DIRS')])
  })

  check(
    'stays silent for a relative path of CLAUDE_CODE_PLUGIN_DIRS, which Claude Code skips',
    () => {
      expect(run({ dev: 'CLAUDE_CODE_PLUGIN_DIRS=. claude' })).toEqual([])
      expect(run({ dev: 'CLAUDE_CODE_PLUGIN_DIRS=~/x:./y claude' })).toEqual([])
    },
  )

  check.each([
    ['a plugin root', { '.claude-plugin/plugin.json': MANIFEST }],
    [
      'a folder that is a marketplace root and a plugin root',
      { '.claude-plugin/plugin.json': MANIFEST, '.claude-plugin/marketplace.json': MARKET },
    ],
    ['a folder with no .claude-plugin', {}],
  ])('stays silent for %s', (_title, files) => {
    expect(run({ dev: 'claude --plugin-dir .' }, files)).toEqual([])
  })

  // With no `plugin.json`, a `"."` entry makes the marketplace root a plugin. `--plugin-dir` does
  // not read `marketplace.json`, so only a marketplace with no other entry loses no plugin.
  const listing = (...sources: unknown[]) =>
    JSON.stringify({
      name: 'm',
      owner: { name: 'o' },
      plugins: sources.map((source, index) => ({ name: `p${index}`, source })),
    })
  check('stays silent for a marketplace root whose only entry is the root itself', () => {
    expect(
      run({ dev: 'claude --plugin-dir .' }, { '.claude-plugin/marketplace.json': listing('.') }),
    ).toEqual([])
    expect(
      run(
        { dev: 'claude --plugin-dir .' },
        { '.claude-plugin/marketplace.json': listing('.', './') },
      ),
    ).toEqual([])
  })

  check('reports a marketplace root that lists itself and another plugin', () => {
    const files = {
      '.claude-plugin/marketplace.json': listing('.', './plugins/p'),
      'plugins/p/x.md': '',
    }
    expect(texts(run({ dev: 'claude --plugin-dir .' }, files))).toEqual([message('dev', '.')])
    const remote = {
      '.claude-plugin/marketplace.json': listing('.', { source: 'github', repo: 'o/r' }),
    }
    expect(texts(run({ dev: 'claude --plugin-dir .' }, remote))).toEqual([message('dev', '.')])
  })

  check('reports a marketplace root whose entries name a folder that is not there', () => {
    const files = { '.claude-plugin/marketplace.json': listing('./plugins/gone') }
    expect(texts(run({ dev: 'claude --plugin-dir .' }, files))).toEqual([message('dev', '.')])
  })

  check('stays silent for the plugin folder under a marketplace root', () => {
    const files = {
      '.claude-plugin/marketplace.json': MARKET,
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
    }
    expect(run({ dev: 'claude --plugin-dir ./plugins/p' }, files)).toEqual([])
  })

  check('stays silent for a folder of plugins with no marketplace.json', () => {
    const files = { 'plugins/p/.claude-plugin/plugin.json': MANIFEST }
    expect(run({ dev: 'claude --plugin-dir ./plugins' }, files)).toEqual([])
  })

  check('stays silent for an empty value at a marketplace root', () => {
    expect(run({ dev: 'claude --plugin-dir=' })).toEqual([])
    expect(run({ dev: 'claude --plugin-dir ""' })).toEqual([])
  })

  check('reads only the word after the flag', () => {
    const files = {
      '.claude-plugin/marketplace.json': MARKET,
      'plugins/p/.claude-plugin/plugin.json': MANIFEST,
    }
    expect(run({ dev: 'claude --plugin-dir ./plugins/p .' }, files)).toEqual([])
  })

  check('reports a marketplace.json that does not parse, as the file marks the folder', () => {
    expect(
      run({ dev: 'claude --plugin-dir .' }, { '.claude-plugin/marketplace.json': '{' }),
    ).toHaveLength(1)
  })

  check.each([
    ['a path above the repository', 'claude --plugin-dir ../../..'],
    ['a path with a variable', 'claude --plugin-dir "$PWD"'],
    ['a path with a substitution', 'claude --plugin-dir "$(pwd)"'],
    ['a path from the home folder', 'claude --plugin-dir ~/mk'],
    ['a glob', 'claude --plugin-dir ./*'],
    ['a flag with no value', 'claude --plugin-dir'],
    ['an empty value', 'claude --plugin-dir='],
    ['a path that is not there', 'claude --plugin-dir ./missing'],
    ['a path that is a file', 'claude --plugin-dir ./package.json'],
  ])('stays silent for %s', (_title, command) => {
    expect(run({ dev: command }, undefined, 'a/b')).toEqual([])
  })

  check.each([
    ['another flag', 'claude --add-dir .'],
    ['a word that holds the flag', 'claude --plugin-directory .'],
    ['a word that holds the flag with an equals sign', 'claude --plugin-directory=.'],
    ['no flag', 'echo hi'],
  ])('stays silent at a marketplace root for %s', (_title, command) => {
    expect(run({ dev: command })).toEqual([])
  })

  check('stays silent for a folder whose name holds a variable mark', () => {
    const files = { '$X/.claude-plugin/marketplace.json': MARKET }
    expect(run({ dev: "claude --plugin-dir '$X'" }, files)).toEqual([])
  })

  check('splits a list of CLAUDE_CODE_PLUGIN_DIRS at a semicolon', () => {
    const top = tree({ '.claude-plugin/marketplace.json': MARKET })
    const code = scripts({ dev: `CLAUDE_CODE_PLUGIN_DIRS="/elsewhere;${top}" claude` })
    const found = lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)
    expect(texts(found)).toEqual([message('dev', top, 'CLAUDE_CODE_PLUGIN_DIRS')])
  })

  linked('stays silent for a link to a folder out of the repository', () => {
    const top = tree({})
    const elsewhere = tree({ '.claude-plugin/marketplace.json': MARKET }, false)
    link(top, 'out', elsewhere)
    const code = scripts({ dev: 'claude --plugin-dir ./out' })
    expect(lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)).toEqual(
      [],
    )
  })

  linked('stays silent for a marketplace root with an entry whose source it cannot see', () => {
    const top = tree({ '.claude-plugin/marketplace.json': listing('.', './gone/p') })
    link(top, 'gone', path.join(top, 'nothing'))
    const code = scripts({ dev: 'claude --plugin-dir .' })
    expect(lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)).toEqual(
      [],
    )
  })

  linked('stays silent for a link with no target', () => {
    const top = tree({})
    link(top, 'gone', path.join(top, 'nothing'))
    const code = scripts({ dev: 'claude --plugin-dir ./gone' })
    expect(lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)).toEqual(
      [],
    )
  })

  linked('stays silent when the marketplace.json is a link out of the repository', () => {
    const top = tree({})
    const elsewhere = tree({ 'marketplace.json': MARKET }, false)
    link(top, '.claude-plugin/marketplace.json', path.join(elsewhere, 'marketplace.json'))
    const code = scripts({ dev: 'claude --plugin-dir .' })
    expect(lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)).toEqual(
      [],
    )
  })

  linked('reports a link to a marketplace folder inside the repository', () => {
    const top = tree({ 'mk/.claude-plugin/marketplace.json': MARKET })
    link(top, 'alias', 'mk')
    const code = scripts({ dev: 'claude --plugin-dir ./alias' })
    expect(
      lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code),
    ).toHaveLength(1)
  })

  check(
    'stays silent for a script that is not a string, and for scripts that is not an object',
    () => {
      const top = tree({ '.claude-plugin/marketplace.json': MARKET })
      const file = path.join(top, 'package.json')
      const lint = (code: string) => lintPluginFile(RULE, ['**/package.json'], file, code)
      expect(lint('{"scripts":{"dev":["claude --plugin-dir ."]}}')).toEqual([])
      expect(lint('{"scripts":["claude --plugin-dir ."]}')).toEqual([])
      expect(lint('{"name":"x"}')).toEqual([])
    },
  )

  check('reads the last of two repeated script names', () => {
    const top = tree({ '.claude-plugin/marketplace.json': MARKET })
    const code = '{"scripts":{"dev":"claude --plugin-dir .","dev":"claude"}}'
    expect(lintPluginFile(RULE, ['**/package.json'], path.join(top, 'package.json'), code)).toEqual(
      [],
    )
  })

  check('stays silent in a repository with no .git', () => {
    const top = tree({ '.claude-plugin/marketplace.json': MARKET }, false)
    const code = scripts({ dev: 'claude --plugin-dir ../..' })
    expect(
      lintPluginFile(RULE, ['**/package.json'], path.join(top, 'a', 'package.json'), code),
    ).toEqual([])
  })
})
