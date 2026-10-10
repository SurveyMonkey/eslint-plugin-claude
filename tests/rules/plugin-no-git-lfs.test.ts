// A Git install never downloads LFS content, so a plugin file that a
// `.gitattributes` pattern sends to Git LFS arrives as a pointer file (host a
// marketplace, "Keep plugin files out of Git LFS"). The trees are on disk,
// because the rule reads the `.gitattributes` files and lists the plugin. The
// files glob is in tests/configs.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { link, noLinks, tree } from '../marketplace-tree.test-support.ts'
import { lintPlugin } from '../plugin-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from '../rule-tester.test-support.ts'

const RULE = 'plugin-no-git-lfs'
const check = it
const linked = noLinks ? it.skip : check
const locked = chmodCannotBlock ? it.skip : check
const MANIFEST = '{"name": "p"}'
const LFS = 'filter=lfs diff=lfs merge=lfs -text'
const message = (pattern: string, attributes: string, file: string) =>
  `The \`.gitattributes\` pattern \`${pattern}\` in \`${attributes}\` sends \`${file}\` to Git LFS. A Git install never downloads LFS content, so the file arrives as a pointer file. Keep plugin files out of Git LFS.`

/** The plugin at `at` in a repository that holds `files`. The result is the repository, and the
 *  messages. */
function lintTree(files: Record<string, string>, at = '') {
  const top = tree({ ...files, [`${at}.claude-plugin/plugin.json`]: MANIFEST })
  return { top, found: lintPlugin(RULE, path.join(top, at), MANIFEST) }
}
/** The messages for a plugin at the repository root with `.gitattributes` text `attrs`. */
const run = (attrs: string, ...names: string[]) =>
  lintTree({ '.gitattributes': attrs, ...Object.fromEntries(names.map((n) => [n, ''])) }).found.map(
    (m) => m.message,
  )

describe(RULE, () => {
  check('reports the pattern, the attributes file and the file, on the document', () => {
    const { found } = lintTree({ '.gitattributes': `*.bin ${LFS}\n`, 'data/model.bin': '' })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'lfs',
      message: message('*.bin', '.gitattributes', 'data/model.bin'),
      line: 1,
      column: 1,
    })
  })

  // Each row: the pattern, and a file that it matches in a plugin at the repository root.
  check.each([
    ['*.bin', 'a.bin'],
    ['*.bin', 'deep/x/a.bin'],
    ['data/*.bin', 'data/a.bin'],
    ['/data/*.bin', 'data/a.bin'],
    ['**/*.bin', 'a.bin'],
    ['**/*.bin', 'x/y/a.bin'],
    ['data/**', 'data/x/y.txt'],
    ['a/**/b.bin', 'a/b.bin'],
    ['a/**/b.bin', 'a/x/y/b.bin'],
    ['a**b', 'axxb'],
    ['a/**b', 'a/xb'],
    ['?.bin', 'a.bin'],
    ['[ab].bin', 'a.bin'],
    ['[!a].bin', 'b.bin'],
    ['[^a].bin', 'b.bin'],
    ['[a-c].bin', 'b.bin'],
    ['[]a].bin', '].bin'],
    ['[\\]]x', ']x'],
    ['a\\.bin', 'a.bin'],
    ['a+b(1).bin', 'a+b(1).bin'],
    ['*', 'a.txt'],
    ['*', '.claude-plugin/plugin.json'],
    ['.claude-plugin/*.json', '.claude-plugin/plugin.json'],
  ])('reports the pattern %s for %s', (pattern, file) => {
    const { found } = lintTree({ '.gitattributes': `${pattern} ${LFS}\n`, [file]: '' })
    expect(found.map((m) => m.messageId)).toEqual(['lfs'])
  })

  check('reports a pattern with other attributes around the filter', () => {
    expect(run('*.bin text=auto filter=lfs -diff\n', 'a.bin')).toHaveLength(1)
  })

  check('reports a line after comments, blank lines, tabs and Windows line endings', () => {
    const attrs = `# LFS\r\n\r\n   \r\n*.txt\ttext\r\n*.bin\t\tfilter=lfs\r\n`
    expect(run(attrs, 'a.bin')).toEqual([message('*.bin', '.gitattributes', 'a.bin')])
  })

  check('reports a pattern in the .gitattributes of a folder above the plugin', () => {
    const { found } = lintTree(
      { '.gitattributes': `plugins/p/*.bin ${LFS}\n`, 'plugins/p/a.bin': '' },
      'plugins/p/',
    )
    expect(found.map((m) => m.message)).toEqual([
      message('plugins/p/*.bin', '.gitattributes', 'a.bin'),
    ])
  })

  check('reports a pattern of the repository root for a file of a plugin below it', () => {
    const { found } = lintTree(
      { '.gitattributes': `*.bin ${LFS}\n`, 'plugins/p/data/a.bin': '' },
      'plugins/p/',
    )
    expect(found.map((m) => m.message)).toEqual([message('*.bin', '.gitattributes', 'data/a.bin')])
  })

  check('reads a pattern of a .gitattributes in the plugin from the folder of that file', () => {
    const { found } = lintTree(
      { 'plugins/p/.gitattributes': `data/*.bin ${LFS}\n`, 'plugins/p/data/a.bin': '' },
      'plugins/p/',
    )
    expect(found.map((m) => m.message)).toEqual([
      message('data/*.bin', 'plugins/p/.gitattributes', 'data/a.bin'),
    ])
  })

  check('reports a .gitattributes in a folder of the plugin for the files below it only', () => {
    const files = {
      'sub/.gitattributes': `*.bin ${LFS}\n`,
      'sub/deep/a.bin': '',
      'other/b.bin': '',
    }
    expect(lintTree(files).found.map((m) => m.message)).toEqual([
      message('*.bin', 'sub/.gitattributes', 'sub/deep/a.bin'),
    ])
  })

  check('lets a .gitattributes in a deeper folder turn the filter on again', () => {
    const files = {
      '.gitattributes': '*.bin -filter\n',
      'sub/.gitattributes': `*.bin ${LFS}\n`,
      'sub/a.bin': '',
    }
    expect(lintTree(files).found).toHaveLength(1)
  })

  check('reports the first file in name order, with the folders in the same order', () => {
    const files = { '.gitattributes': `*.bin ${LFS}\n`, 'z.bin': '', 'a/x.bin': '', 'b.bin': '' }
    expect(lintTree(files).found.map((m) => m.message)).toEqual([
      message('*.bin', '.gitattributes', 'a/x.bin'),
    ])
  })

  check('sees the files below the plugin root only', () => {
    const files = {
      '.gitattributes': `*.bin ${LFS}\n`,
      'docs/outside.bin': '',
      'plugins/p/ok.txt': '',
    }
    expect(lintTree(files, 'plugins/p/').found).toEqual([])
  })

  linked('reports a link to a file, which Git stores as a file', () => {
    const { top } = lintTree({ '.gitattributes': `*.bin ${LFS}\n`, real: '' })
    link(top, 'big.bin', 'real')
    expect(lintPlugin(RULE, top, MANIFEST)).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['no .gitattributes', {}],
    ['a pattern with no filter', { '.gitattributes': '*.bin text\n', 'a.bin': '' }],
    ['a filter other than lfs', { '.gitattributes': '*.bin filter=crypt\n', 'a.bin': '' }],
    ['a filter value in capitals', { '.gitattributes': '*.bin filter=LFS\n', 'a.bin': '' }],
    ['a filter set with no value', { '.gitattributes': '*.bin filter\n', 'a.bin': '' }],
    ['a filter that is unset', { '.gitattributes': '*.bin -filter\n', 'a.bin': '' }],
    ['a filter that is unspecified', { '.gitattributes': `*.bin ${LFS} !filter\n`, 'a.bin': '' }],
    ['a pattern that matches no file', { '.gitattributes': `*.png ${LFS}\n`, 'a.bin': '' }],
    ['a commented line', { '.gitattributes': `# *.bin ${LFS}\n`, 'a.bin': '' }],
    ['a negative pattern', { '.gitattributes': `!*.bin ${LFS}\n`, 'a.bin': '' }],
    ['a macro line', { '.gitattributes': `[attr]big ${LFS}\n`, 'a.bin': '' }],
    ['a quoted pattern', { '.gitattributes': `"a b.bin" ${LFS}\n`, 'a b.bin': '' }],
    [
      'a folder pattern with a trailing slash',
      { '.gitattributes': `data/ ${LFS}\n`, 'data/a.bin': '' },
    ],
    ['a pattern with a name only', { '.gitattributes': '*.bin\n', 'a.bin': '' }],
    ['a root pattern for a nested file', { '.gitattributes': `/a.bin ${LFS}\n`, 'x/a.bin': '' }],
    [
      'an anchored pattern for a deeper file',
      { '.gitattributes': `data/*.bin ${LFS}\n`, 'x/data/a.bin': '' },
    ],
    [
      'a star that does not cross a slash',
      { '.gitattributes': `data/*.bin ${LFS}\n`, 'data/x/a.bin': '' },
    ],
    [
      'a question mark that does not match a slash',
      { '.gitattributes': `a?b/c ${LFS}\n`, 'a/b/c': '' },
    ],
    [
      'a class that does not hold the letter',
      { '.gitattributes': `[!a].bin ${LFS}\n`, 'a.bin': '' },
    ],
    ['a class that is not in the range', { '.gitattributes': `[a-c].bin ${LFS}\n`, 'd.bin': '' }],
    [
      'a folder pattern with a double star for the folder itself',
      { '.gitattributes': `data/** ${LFS}\n`, data: '' },
    ],
    ['an escaped dot', { '.gitattributes': `a\\.bin ${LFS}\n`, axbin: '' }],
    ['a class that ends with a backslash', { '.gitattributes': `[a\\ ${LFS}\n`, 'a.bin': '' }],
    ['a class that is not closed', { '.gitattributes': `[ab.bin ${LFS}\n`, 'a.bin': '' }],
    [
      'a backslash at the end of the pattern',
      { '.gitattributes': `a.bin\\ ${LFS}\n`, 'a.bin': '' },
    ],
    ['a class with a POSIX name', { '.gitattributes': `[[:alpha:]].bin ${LFS}\n`, 'a.bin': '' }],
    ['a file in node_modules', { '.gitattributes': `*.bin ${LFS}\n`, 'node_modules/x/a.bin': '' }],
    [
      'a file in a nested .git folder',
      { '.gitattributes': `*.bin ${LFS}\n`, 'sub/.git/a.bin': '' },
    ],
  ])('stays silent for %s', (_title, files) => {
    expect(lintTree(files).found).toEqual([])
  })

  check.each([
    ['a later line that unsets the filter', `*.bin ${LFS}\n*.bin -filter\n`],
    ['a later line that sets another filter', `*.bin ${LFS}\n*.bin filter=crypt\n`],
    ['a later line that makes the filter unspecified', `*.bin ${LFS}\n*.bin !filter\n`],
  ])('stays silent for %s', (_title, attrs) => {
    expect(run(attrs, 'a.bin')).toEqual([])
  })

  check('stays silent when a deeper .gitattributes unsets the filter', () => {
    const files = {
      '.gitattributes': `*.bin ${LFS}\n`,
      'sub/.gitattributes': '*.bin -filter\n',
      'sub/a.bin': '',
    }
    expect(lintTree(files).found).toEqual([])
  })

  check('stays silent when the plugin .gitattributes unsets the filter of the root one', () => {
    const files = {
      '.gitattributes': `*.bin ${LFS}\n`,
      'plugins/p/.gitattributes': '*.bin -filter\n',
      'plugins/p/a.bin': '',
    }
    expect(lintTree(files, 'plugins/p/').found).toEqual([])
  })

  check('stays silent for the .gitattributes of a sibling folder', () => {
    const files = { 'other/.gitattributes': `*.bin ${LFS}\n`, 'sub/a.bin': '' }
    expect(lintTree(files).found).toEqual([])
  })

  check('stays silent for a .gitattributes that is a folder', () => {
    const { top } = lintTree({ '.gitattributes/x': '', 'a.bin': '' })
    expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
  })

  linked('stays silent for a .gitattributes that is a link, which Git ignores', () => {
    const { top } = lintTree({ 'real-attrs': `*.bin ${LFS}\n`, 'a.bin': '' })
    link(top, '.gitattributes', 'real-attrs')
    expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
  })

  linked('stays silent for a file behind a link to a folder', () => {
    const { top } = lintTree({ '.gitattributes': `*.bin ${LFS}\n`, 'docs/a.bin': '' }, 'plugins/p/')
    link(top, 'plugins/p/alias', '../../docs')
    expect(lintPlugin(RULE, path.join(top, 'plugins', 'p'), MANIFEST)).toEqual([])
  })

  linked('stays silent for a plugin root that is a link out of the repository', () => {
    const elsewhere = tree({ 'p/.gitattributes': `*.bin ${LFS}\n`, 'p/a.bin': '' })
    const top = tree({ 'meta/plugin.json': MANIFEST })
    link(top, 'p', path.join(elsewhere, 'p'))
    link(path.join(elsewhere, 'p'), '.claude-plugin', path.join(top, 'meta'))
    expect(lintPlugin(RULE, path.join(top, 'p'), MANIFEST)).toEqual([])
  })

  locked('stays silent for a .gitattributes that it cannot read', () => {
    const { top } = lintTree({ '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '' })
    expect(lintPlugin(RULE, top, MANIFEST)).toHaveLength(1)
    withoutAccess(path.join(top, '.gitattributes'), () => {
      expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
    })
  })

  locked('stays silent for a .gitattributes above the plugin that it cannot read', () => {
    const files = { '.gitattributes': `*.bin ${LFS}\n`, 'plugins/p/a.bin': '' }
    const { top } = lintTree(files, 'plugins/p/')
    const plugin = path.join(top, 'plugins', 'p')
    expect(lintPlugin(RULE, plugin, MANIFEST)).toHaveLength(1)
    withoutAccess(path.join(top, '.gitattributes'), () => {
      expect(lintPlugin(RULE, plugin, MANIFEST)).toEqual([])
    })
  })

  locked('stays silent for the files of a folder that it cannot list', () => {
    const { top } = lintTree({ '.gitattributes': `*.bin ${LFS}\n`, 'sub/b.bin': '' })
    expect(lintPlugin(RULE, top, MANIFEST)).toHaveLength(1)
    withoutAccess(path.join(top, 'sub'), () => {
      expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
    })
  })

  locked('stays silent for the files of a folder with a .gitattributes that it cannot read', () => {
    const files = {
      '.gitattributes': `*.bin ${LFS}\n`,
      'sub/.gitattributes': '-text\n',
      'sub/b.bin': '',
    }
    const { top } = lintTree(files)
    expect(lintPlugin(RULE, top, MANIFEST)).toHaveLength(1)
    withoutAccess(path.join(top, 'sub', '.gitattributes'), () => {
      expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
    })
  })

  locked('reports a file that is not below the folder that it cannot list', () => {
    const files = { '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '', 'sub/b.txt': '' }
    const { top } = lintTree(files)
    withoutAccess(path.join(top, 'sub'), () => {
      expect(lintPlugin(RULE, top, MANIFEST).map((m) => m.message)).toEqual([
        message('*.bin', '.gitattributes', 'a.bin'),
      ])
    })
  })

  linked('stays silent for a .claude-plugin directory out of the repository', () => {
    const elsewhere = tree({ 'p/plugin.json': MANIFEST })
    const top = tree({ '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '' })
    link(top, '.claude-plugin', path.join(elsewhere, 'p'))
    expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
  })

  check('stays silent for a directory with no manifest on disk', () => {
    const top = tree({ '.gitattributes': `*.bin ${LFS}\n`, 'a.bin': '' })
    expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
  })

  // The text on disk differs from the text that the linter gets, so that the linter parses it.
  check.each([
    ['a manifest that does not parse', '{'],
    ['a manifest that is an array', '[]'],
  ])('makes no report for %s on disk', (_title, text) => {
    const top = tree({
      '.gitattributes': `*.bin ${LFS}\n`,
      'a.bin': '',
      '.claude-plugin/plugin.json': text,
    })
    expect(lintPlugin(RULE, top, MANIFEST)).toEqual([])
  })
})
