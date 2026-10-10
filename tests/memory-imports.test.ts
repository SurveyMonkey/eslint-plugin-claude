// The `@path` imports of an instruction file
// (https://code.claude.com/docs/en/memory#import-additional-files). The lookup and the walk
// use trees on disk.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  candidates,
  findImport,
  followImports,
  locate,
  parseImports,
  readImported,
} from '../src/memory-imports.ts'
import { UNREADABLE } from '../src/skill-tree.ts'
import { link, noLinks, tree } from './memory-tree.test-support.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

const paths = (text: string) => parseImports(text).map((item) => item.path)

describe('parseImports', () => {
  it('reads the examples of the docs', () => {
    expect(paths('See @README for project overview and @package.json for npm commands.')).toEqual([
      'README',
      'package.json',
    ])
    expect(paths('# Additional Instructions\n- git workflow @docs/git-instructions.md')).toEqual([
      'docs/git-instructions.md',
    ])
    expect(paths('# Individual Preferences\n- @~/.claude/my-project-instructions.md')).toEqual([
      '~/.claude/my-project-instructions.md',
    ])
    expect(paths('- API conventions @Design\\ Docs/api-conventions.md')).toEqual([
      'Design Docs/api-conventions.md',
    ])
  })

  it('gives the offset and the length of the token', () => {
    expect(parseImports('ab @x.md cd')).toEqual([{ path: 'x.md', index: 3, length: 5 }])
    expect(parseImports('@a\\ b.md')).toEqual([{ path: 'a b.md', index: 0, length: 8 }])
  })

  it('ends the path at the first space, even on a line of its own', () => {
    expect(paths('@Design Docs/api.md')).toEqual(['Design'])
  })

  it('skips a path in quotes', () => {
    expect(paths('@"Design Docs/api.md" and @\'x.md\' and @"a\\ b.md"')).toEqual([])
  })

  it('needs the @ at the start of the text or after white space', () => {
    expect(paths('mail me@example.com, (@x.md) and a@b')).toEqual([])
    expect(paths('@a.md\n@b.md\t@c.md\r\n@d.md')).toEqual(['a.md', 'b.md', 'c.md', 'd.md'])
    expect(paths('\\@x.md and **x**@y.md')).toEqual([])
  })

  it('skips a code span that ends the text', () => {
    expect(paths('`@x.md`')).toEqual([])
  })

  it('skips a code span', () => {
    expect(paths('Write `@README` to keep the text, and @README to import it.')).toEqual(['README'])
    expect(paths('Use ``a ` @x.md`` and ```@y.md``` here')).toEqual([])
    expect(paths('A span `over\n@x.md\nlines` ends.')).toEqual([])
    // A mask does not start an import, and does not end a token early.
    expect(paths('`a`@x.md and @y.md`b`')).toEqual(['y.md'])
  })

  it('does not close a code span with a run of another length', () => {
    expect(paths('``a ` @x.md ``` @y.md')).toEqual(['x.md', 'y.md'])
  })

  it('does not let a code span cross a blank line', () => {
    expect(paths('A `lone tick\n\n@x.md here and `y` ok')).toEqual(['x.md'])
    expect(paths('A `lone tick\n  \n@x.md here and `y` ok')).toEqual(['x.md'])
  })

  it('reads an escaped backtick as text', () => {
    expect(paths('a \\` @x.md and `b')).toEqual(['x.md'])
  })

  it('skips a fenced block, with backticks or tildes, to the closing fence', () => {
    expect(paths('```text\n@a.md\n```\n@b.md')).toEqual(['b.md'])
    expect(paths('~~~\n@a.md\n~~~\n@b.md')).toEqual(['b.md'])
    expect(paths('````\n```\n@a.md\n```\n````\n@b.md')).toEqual(['b.md'])
    expect(paths('- ```\n  @a.md\n  ```\n@b.md')).toEqual(['b.md'])
    expect(paths('> ```\n> @a.md\n> ```\n@b.md')).toEqual(['b.md'])
    expect(paths('```\r\n@a.md\r\n```\r\n@b.md')).toEqual(['b.md'])
  })

  it('reads a tilde fence with a backtick in the info string as a fence', () => {
    expect(paths('~~~js`x\n@a.md\n~~~\n@b.md')).toEqual(['b.md'])
  })

  it('skips only a path that starts with a quote, and keeps each escaped space', () => {
    expect(paths('@a"b.md @"c.md')).toEqual(['a"b.md'])
    expect(paths('@a\\ b\\ c.md')).toEqual(['a b c.md'])
  })

  it('keeps a fence open until a fence of the same mark and a size that is at least as long', () => {
    expect(paths('```\n~~~\n@a.md\n``\n@b.md')).toEqual([])
    expect(paths('````\n```\n@a.md\n```x\n@b.md')).toEqual([])
    expect(paths('~~~\n```\n@a.md\n~~~ x\n@b.md')).toEqual([])
  })

  it('skips to the end of the text for a fence that never closes', () => {
    expect(paths('@a.md\n```\n@b.md\n@c.md')).toEqual(['a.md'])
  })

  it('reads a line with three backticks and a backtick in the info as a code span', () => {
    expect(paths('```js`\n@a.md')).toEqual(['a.md'])
    expect(paths('```js`  x```\n@a.md')).toEqual(['a.md'])
  })

  it('does not skip an indented block, because the docs name fences and spans only', () => {
    expect(paths('Text\n\n    @a.md')).toEqual(['a.md'])
  })

  it('skips an HTML comment, also one that never closes', () => {
    expect(paths('<!-- @a.md -->\n@b.md')).toEqual(['b.md'])
    expect(paths('<!--\n@a.md\n-->\n@b.md')).toEqual(['b.md'])
    expect(paths('@a.md\n<!-- @b.md')).toEqual(['a.md'])
  })
})

describe('candidates', () => {
  const forms = (written: string) => candidates({ path: written, index: 0, length: 0 })

  it('gives the path as written', () => {
    expect(forms('docs/a.md')).toEqual(['docs/a.md'])
    expect(forms('/abs/a.md')).toEqual(['/abs/a.md'])
    expect(forms('../a.md')).toEqual(['../a.md'])
  })

  it('adds the forms without a mark at the end and without a fragment', () => {
    expect(forms('docs/a.md.')).toEqual(['docs/a.md.', 'docs/a.md'])
    expect(forms('docs/a.md),')).toEqual(['docs/a.md),', 'docs/a.md'])
    expect(forms('docs/a.md#top')).toEqual(['docs/a.md#top', 'docs/a.md'])
    expect(forms('docs/a.md#top.')).toEqual(['docs/a.md#top.', 'docs/a.md', 'docs/a.md#top'])
  })

  it('gives no form for a path that is not a path in the repository', () => {
    expect(forms('~/a.md')).toEqual([])
    expect(forms('~')).toEqual([])
    expect(forms('https://example.com/a.md')).toEqual([])
    expect(forms('C:/a.md')).toEqual([])
    expect(forms('.')).toEqual(['.'])
  })
})

const files = {
  'CLAUDE.md': '@a.md\n',
  'a.md': 'a\n',
  'dir/b.md': 'b\n',
  'secret/s.md': 's\n',
}

describe('locate', () => {
  it('finds a file and a directory by the real path', () => {
    const root = tree(files)
    expect(locate(path.join(root, 'a.md'), root)).toEqual({ real: path.join(root, 'a.md') })
    expect(locate(path.join(root, 'dir'), root)).toEqual({ real: path.join(root, 'dir') })
  })

  it('says missing for a file that is not there, also below a directory that is not there', () => {
    const root = tree(files)
    expect(locate(path.join(root, 'none.md'), root)).toBe('missing')
    expect(locate(path.join(root, 'none', 'x.md'), root)).toBe('missing')
    expect(locate(path.join(root, 'a.md', 'x.md'), root)).toBe('missing')
  })

  it('gives UNREADABLE for a path out of the bound, found or missing', () => {
    const root = tree(files)
    const bound = path.join(root, 'dir')
    expect(locate(path.join(root, 'a.md'), bound)).toBe(UNREADABLE)
    expect(locate(path.join(root, 'none.md'), bound)).toBe(UNREADABLE)
  })

  it.skipIf(noLinks)('follows a link inside the bound, and refuses one out of it', () => {
    const outside = tree({ 'x.md': 'x\n' })
    const root = tree(files)
    link(root, 'in.md', 'a.md')
    link(root, 'out.md', path.join(outside, 'x.md'))
    expect(locate(path.join(root, 'in.md'), root)).toEqual({ real: path.join(root, 'a.md') })
    expect(locate(path.join(root, 'out.md'), root)).toBe(UNREADABLE)
  })

  it.skipIf(noLinks)('gives UNREADABLE for a dangling link, and for a path below one', () => {
    const root = tree(files)
    link(root, 'gone.md', 'nowhere.md')
    link(root, 'gone-dir', 'nowhere')
    expect(locate(path.join(root, 'gone.md'), root)).toBe(UNREADABLE)
    expect(locate(path.join(root, 'gone-dir', 'x.md'), root)).toBe(UNREADABLE)
  })

  it.skipIf(chmodCannotBlock)('gives UNREADABLE for a directory that it cannot read', () => {
    const root = tree(files)
    withoutAccess(path.join(root, 'secret'), () => {
      expect(locate(path.join(root, 'secret', 's.md'), root)).toBe(UNREADABLE)
    })
  })
})

describe('readImported', () => {
  it('reads a file, gives null for a directory, and UNREADABLE for a failed read', () => {
    const root = tree(files)
    expect(readImported(path.join(root, 'a.md'))).toBe('a\n')
    expect(readImported(path.join(root, 'dir'))).toBeNull()
    expect(readImported(path.join(root, 'none.md'))).toBe(UNREADABLE)
  })
})

describe('findImport', () => {
  it('takes the first form that is there', () => {
    const root = tree(files)
    expect(findImport(root, ['none.md', 'a.md'], root)).toEqual({ real: path.join(root, 'a.md') })
    expect(findImport(root, ['dir/../a.md'], root)).toEqual({ real: path.join(root, 'a.md') })
  })

  it('says missing when no form is there', () => {
    const root = tree(files)
    expect(findImport(root, ['none.md', 'other.md'], root)).toBe('missing')
  })

  it('gives UNREADABLE when no form is there and one cannot be read', () => {
    const root = tree(files)
    expect(findImport(root, ['none.md', '../none.md'], root)).toBe(UNREADABLE)
    expect(findImport(root, ['../none.md', 'none.md'], root)).toBe(UNREADABLE)
  })

  it('takes a form that is there, although another form cannot be read', () => {
    const root = tree(files)
    expect(findImport(root, ['../none.md', 'a.md'], root)).toEqual({
      real: path.join(root, 'a.md'),
    })
  })
})

/** A chain of `n` files `f1.md` to `fn.md`, each importing the next, and a root that imports `f1.md`. */
const chainOf = (n: number, extra: Record<string, string> = {}) => ({
  'CLAUDE.md': '@f1.md\n',
  ...Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`f${i + 1}.md`, i + 1 < n ? `@f${i + 2}.md\n` : 'end\n']),
  ),
  ...extra,
})

describe('followImports', () => {
  const follow = (root: string, limit: number, text?: string) => {
    const file = path.join(root, 'CLAUDE.md')
    return followImports(file, text ?? '@f1.md\n', root, limit)
  }

  it('loads each file at its hops from the root', () => {
    const root = tree(chainOf(3))
    const chain = follow(root, 4)
    expect(
      Object.fromEntries([...chain.loaded].map(([f, n]) => [path.relative(root, f), n])),
    ).toEqual({
      'CLAUDE.md': 0,
      'f1.md': 1,
      'f2.md': 2,
      'f3.md': 3,
    })
    expect(chain.tooDeep.size).toBe(0)
    expect(chain.unreadable).toBe(false)
  })

  it('reports a file at hop limit + 1 under the import of the root that leads to it', () => {
    const root = tree(chainOf(5, { 'x.md': 'x\n' }))
    const text = '@x.md\n@f1.md\n'
    const edge = follow(root, 4, text)
    expect([...edge.tooDeep].map(([i, f]) => [i, path.relative(root, f)])).toEqual([[1, 'f5.md']])
    expect(edge.loaded.has(path.join(root, 'f4.md'))).toBe(true)
    expect(edge.loaded.has(path.join(root, 'f5.md'))).toBe(false)
    // At the limit, the same chain is within it.
    expect(follow(root, 5, text).tooDeep.size).toBe(0)
  })

  it('counts a configured limit of one', () => {
    const root = tree(chainOf(2))
    expect(follow(root, 1).tooDeep.size).toBe(1)
    expect(follow(root, 2).tooDeep.size).toBe(0)
  })

  it('keeps the first import that leads to a file past the limit', () => {
    const root = tree({ ...chainOf(3), 'g1.md': '@f2.md\n' })
    const chain = follow(root, 2, '@g1.md\n@f1.md\n')
    // f2.md is at hop 2 by g1.md, so f3.md is the first file past the limit.
    expect([...chain.tooDeep.keys()]).toEqual([0])
  })

  it('names the first file past the limit when one import leads to two', () => {
    const root = tree({
      'CLAUDE.md': 'x',
      'f1.md': '@f2.md @g.md\n',
      'f2.md': 'f\n',
      'g.md': 'g\n',
    })
    const chain = follow(root, 1, '@f1.md\n')
    expect([...chain.tooDeep].map(([i, f]) => [i, path.relative(root, f)])).toEqual([[0, 'f2.md']])
  })

  it('ends at a file that it has met, so a cycle loads each file once', () => {
    const root = tree({ 'CLAUDE.md': '@a.md\n', 'a.md': '@b.md\n', 'b.md': '@a.md @CLAUDE.md\n' })
    const chain = follow(root, 4, '@a.md\n')
    expect([...chain.loaded.values()].sort()).toEqual([0, 1, 2])
    expect(chain.tooDeep.size).toBe(0)
  })

  it('resolves a path against the file that holds the import', () => {
    const root = tree({ 'CLAUDE.md': '@docs/a.md\n', 'docs/a.md': '@b.md\n', 'docs/b.md': 'b\n' })
    const chain = follow(root, 4, '@docs/a.md\n')
    expect(chain.loaded.has(path.join(root, 'docs', 'b.md'))).toBe(true)
  })

  it('does not load a path out of the bound, a link out of it, a missing path or a directory', () => {
    const root = tree({ 'CLAUDE.md': 'x', 'dir/d.md': 'd\n' })
    const chain = follow(root, 4, '@../out.md @missing.md @dir @~/x.md')
    expect([...chain.loaded.keys()]).toEqual([path.join(root, 'CLAUDE.md')])
    // The path out of the bound could not be read.
    expect(chain.unreadable).toBe(true)
  })

  it('reports no unreadable file for what is only missing, or a directory', () => {
    const root = tree({ 'CLAUDE.md': 'x', 'dir/d.md': 'd\n' })
    expect(follow(root, 4, '@missing.md @dir').unreadable).toBe(false)
    // An import out of the repository can lead back into it, so the chain is not known.
    expect(follow(root, 4, '@~/x.md').unreadable).toBe(true)
    expect(follow(root, 4, '@https://example.com/x.md').unreadable).toBe(true)
    // A word with a colon is text, such as a name in a note.
    expect(follow(root, 4, '@alice: see @todo: fix').unreadable).toBe(false)
    // The mark holds for an import in a file below the root too.
    const nested = tree({ 'CLAUDE.md': 'x', 'a.md': '@b.md\n', 'b.md': '@~/x.md\n' })
    expect(follow(nested, 4, '@a.md\n').unreadable).toBe(true)
  })

  it('uses the path of a file that is not on disk as the root', () => {
    const root = tree({ 'a.md': 'a\n' })
    const chain = follow(root, 4, '@a.md\n')
    expect(chain.loaded.get(path.join(root, 'CLAUDE.md'))).toBe(0)
    expect(chain.loaded.get(path.join(root, 'a.md'))).toBe(1)
  })

  it.skipIf(chmodCannotBlock)('marks a chain with a file that it cannot read', () => {
    const root = tree({ 'CLAUDE.md': 'x', 'a.md': '@b.md\n', 'b.md': 'b\n' })
    withoutAccess(path.join(root, 'a.md'), () => {
      const chain = follow(root, 4, '@a.md\n')
      expect(chain.unreadable).toBe(true)
      expect(chain.loaded.has(path.join(root, 'a.md'))).toBe(false)
    })
  })

  it.skipIf(noLinks)('loads a link inside the bound at the real path', () => {
    const root = tree({ 'CLAUDE.md': 'x', 'real.md': 'r\n' })
    link(root, 'link.md', 'real.md')
    const chain = follow(root, 4, '@link.md\n')
    expect(chain.loaded.get(path.join(root, 'real.md'))).toBe(1)
  })
})
