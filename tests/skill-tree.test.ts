// The files around a skill: the scope root, frontmatter read from text and
// from a file, the Markdown files below a directory, and the plugin manifest.
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifySkillFile } from '../src/skill-files.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readManifest,
  realDirectory,
  repositoryRoot,
  scopeRoot,
  skillFiles,
  statOf,
  UNREADABLE,
} from '../src/skill-tree.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

// The real path, so that a bound compares equal on a system where the
// temporary directory is a link (macOS).
const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'skill-tree-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

const put = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true })
  writeFileSync(path.join(scratch, file), text)
  return path.join(scratch, file)
}

const plugin = path.join(scratch, 'plugins', 'p')
put('plugins/p/.claude-plugin/plugin.json', '{"name":"p","skills":"./extra"}')

const rootOf = (file: string) => {
  const info = classifySkillFile(file)
  if (info === null) {
    throw new Error(`${file} is not a skill file`)
  }
  return scopeRoot(file, info)
}

describe('scopeRoot', () => {
  it('finds .claude/ for a skill and for a command at any depth', () => {
    const claude = path.join(scratch, '.claude')
    expect(rootOf(path.join(claude, 'skills', 's', 'SKILL.md'))).toBe(claude)
    expect(rootOf(path.join(claude, 'commands', 'c.md'))).toBe(claude)
    expect(rootOf(path.join(claude, 'commands', 'a', 'b', 'c.md'))).toBe(claude)
  })

  it('finds the plugin root for a skill, a command and the root skill', () => {
    expect(rootOf(path.join(plugin, 'skills', 's', 'SKILL.md'))).toBe(plugin)
    expect(rootOf(path.join(plugin, 'commands', 'a', 'c.md'))).toBe(plugin)
    expect(rootOf(path.join(plugin, 'SKILL.md'))).toBe(plugin)
  })
})

// `frontmatterOfFile` reads the text that these cases write.
// Each case gets its own time of change, so that no case reads the cache of the case before.
let tick = 2000
const frontmatterOf = (text: string) => {
  const file = put('text.md', text)
  tick += 1
  utimesSync(file, tick, tick)
  return frontmatterOfFile(file)
}

describe('frontmatterOf', () => {
  it('reads the block on line 1', () => {
    expect(frontmatterOf('---\nname: a\n---\n# A\n')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\r\nname: a\r\n---\r\n# A\r\n')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\nname: a\n---')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\nname: a\n---  \n# A\n')).toEqual({ name: 'a' })
    // The block starts with `---` and blanks, as ESLint reads the file that it lints.
    expect(frontmatterOf('---  \nname: a\n---\n# A\n')).toEqual({ name: 'a' })
    expect(frontmatterOf(`${String.fromCharCode(0xfeff)}---\nname: a\n---\n`)).toEqual({
      name: 'a',
    })
  })

  it('gives null without a block, with a block below line 1, or with bad YAML', () => {
    expect(frontmatterOf('# A\n')).toBeNull()
    expect(frontmatterOf('\n---\nname: a\n---\n')).toBeNull()
    expect(frontmatterOf('---\nname: a\n')).toBeNull()
    expect(frontmatterOf('---\nname: [unclosed\n---\n')).toBeNull()
    expect(frontmatterOf('---\nname: a\n...\n')).toBeNull()
    // The closing line holds `---` and nothing else, and the first one counts.
    expect(frontmatterOf('---\nname: a\n---x\n# A\n')).toBeNull()
    expect(frontmatterOf('---\nname: a\n---\n# A\n\n---\n\nname: b\n---\n')).toEqual({ name: 'a' })
  })
})

describe('frontmatterOfFile', () => {
  it('reads a file, and gives null for a missing file', () => {
    expect(frontmatterOfFile(put('a/x.md', '---\nname: x\n---\n'))).toEqual({ name: 'x' })
    expect(frontmatterOfFile(path.join(scratch, 'a', 'none.md'))).toBeNull()
  })

  it('reads a file again when it changes, and gives the same fields when it does not', () => {
    const file = put('a/changing.md', '---\nname: one\n---\n')
    expect(frontmatterOfFile(file)).toEqual({ name: 'one' })
    expect(frontmatterOfFile(file)).toEqual({ name: 'one' })
    // The same size and the same time of change: the file counts as the same.
    put('a/pinned.md', '---\nname: one\n---\n')
    utimesSync(path.join(scratch, 'a/pinned.md'), 1000, 1000)
    expect(frontmatterOfFile(path.join(scratch, 'a/pinned.md'))).toEqual({ name: 'one' })
    put('a/pinned.md', '---\nname: two\n---\n')
    utimesSync(path.join(scratch, 'a/pinned.md'), 1000, 1000)
    expect(frontmatterOfFile(path.join(scratch, 'a/pinned.md'))).toEqual({ name: 'one' })
    // The same size, so only the time of the change differs. The times are set,
    // because a file system with a coarse clock can give two writes one time.
    put('a/changing.md', '---\nname: two\n---\n')
    utimesSync(file, 3000, 3000)
    expect(frontmatterOfFile(file)).toEqual({ name: 'two' })
    put('a/changing.md', '---\nname: three\n---\n')
    utimesSync(file, 4000, 4000)
    expect(frontmatterOfFile(file)).toEqual({ name: 'three' })
    // The same time and a different size: the file changed.
    put('a/sized.md', '---\nname: one\n---\n')
    utimesSync(path.join(scratch, 'a/sized.md'), 1000, 1000)
    expect(frontmatterOfFile(path.join(scratch, 'a/sized.md'))).toEqual({ name: 'one' })
    put('a/sized.md', '---\nname: longer\n---\n')
    utimesSync(path.join(scratch, 'a/sized.md'), 1000, 1000)
    expect(frontmatterOfFile(path.join(scratch, 'a/sized.md'))).toEqual({ name: 'longer' })
  })
})

describe('markdownFiles', () => {
  it('lists .md files at any depth in name order, and nothing for a missing directory', () => {
    put('tree/Z.md', '')
    put('tree/b.md', '')
    put('tree/a/c.md', '')
    put('tree/a/d.txt', '')
    put('tree/readmd', '')
    put('tree/a/e/f.md', '')
    const rel = markdownFiles(path.join(scratch, 'tree'), scratch).files.map((f) =>
      path.relative(path.join(scratch, 'tree'), f).split(path.sep).join('/'),
    )
    expect(rel).toEqual(['a/c.md', 'a/e/f.md', 'b.md', 'Z.md'])
    expect(markdownFiles(path.join(scratch, 'none'), scratch)).toEqual({
      files: [],
      outside: false,
      unreadable: false,
    })
    // A path that is a file, not a directory, has nothing below it.
    expect(markdownFiles(path.join(scratch, 'tree', 'b.md'), scratch)).toEqual({
      files: [],
      outside: false,
      unreadable: false,
    })
  })

  it.skipIf(process.platform === 'win32')(
    'follows a link to a directory once, and ends on a link back up',
    () => {
      put('links/real/x.md', '')
      put('links/other/y.md', '')
      // `alias` sorts before `real`, and still the real directory is the one that is listed.
      symlinkSync('real', path.join(scratch, 'links', 'alias'))
      symlinkSync('..', path.join(scratch, 'links', 'real', 'up'))
      symlinkSync('missing', path.join(scratch, 'links', 'dangling'))
      symlinkSync('other/y.md', path.join(scratch, 'links', 'file.md'))
      // A link to a file that is not Markdown is not listed.
      put('links/other/z.txt', '')
      symlinkSync('other/z.txt', path.join(scratch, 'links', 'note.txt'))
      // A link to a file that is not there is not a file.
      symlinkSync('missing.md', path.join(scratch, 'links', 'dead.md'))
      // These two directories hold many files, and hold no agent or command.
      put('links/node_modules/pkg/readme.md', '')
      put('links/.git/info/note.md', '')
      const rel = markdownFiles(path.join(scratch, 'links'), scratch).files.map((f) =>
        path.relative(path.join(scratch, 'links'), f).split(path.sep).join('/'),
      )
      // `alias` is the same directory as `real`, so its files are not listed twice.
      // A link comes after the real entries.
      expect(rel).toEqual(['other/y.md', 'real/x.md', 'file.md'])
    },
  )
})

describe('skillFiles', () => {
  it('lists the SKILL.md of each folder directly in the directory, in name order', () => {
    put('sk/b/SKILL.md', '')
    put('sk/a/SKILL.md', '')
    put('sk/Z/SKILL.md', '')
    put('sk/c/other.md', '')
    put('sk/d/e/SKILL.md', '')
    put('sk/SKILL.md', '')
    put('sk/f.md', '')
    const rel = skillFiles(path.join(scratch, 'sk'), scratch).map((f) =>
      path.relative(path.join(scratch, 'sk'), f).split(path.sep).join('/'),
    )
    expect(rel).toEqual(['a/SKILL.md', 'b/SKILL.md', 'Z/SKILL.md'])
    expect(skillFiles(path.join(scratch, 'none'), scratch)).toEqual([])
  })

  it.skipIf(process.platform === 'win32')('counts a link to a folder', () => {
    put('sk2/real/SKILL.md', '')
    symlinkSync('real', path.join(scratch, 'sk2', 'alias'))
    const rel = skillFiles(path.join(scratch, 'sk2'), scratch).map((f) =>
      path.relative(path.join(scratch, 'sk2'), f).split(path.sep).join('/'),
    )
    expect(rel).toEqual(['alias/SKILL.md', 'real/SKILL.md'])
  })
})

describe('readManifest', () => {
  it('reads an object, and gives null for a missing, bad or non-object file', () => {
    expect(readManifest(plugin, scratch)).toEqual({ name: 'p', skills: './extra' })
    expect(readManifest(path.join(scratch, 'none'), scratch)).toBeNull()
    put('m1/.claude-plugin/plugin.json', '{')
    expect(readManifest(path.join(scratch, 'm1'), scratch)).toBeNull()
    put('m2/.claude-plugin/plugin.json', '[]')
    expect(readManifest(path.join(scratch, 'm2'), scratch)).toBeNull()
    put('m4/.claude-plugin/plugin.json', '3')
    expect(readManifest(path.join(scratch, 'm4'), scratch)).toBeNull()
    put('m3/.claude-plugin/plugin.json', 'null')
    expect(readManifest(path.join(scratch, 'm3'), scratch)).toBeNull()
  })
})

describe('readManifest on a dangling link', () => {
  it.skipIf(process.platform === 'win32')('gives UNREADABLE for a dangling link', () => {
    mkdirSync(path.join(scratch, 'dangle/.claude-plugin'), { recursive: true })
    symlinkSync('missing.json', path.join(scratch, 'dangle/.claude-plugin/plugin.json'))
    expect(readManifest(path.join(scratch, 'dangle'), scratch)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE when .claude-plugin is a dangling link', {
    skip: process.platform === 'win32',
  }, () => {
    mkdirSync(path.join(scratch, 'dangle-dir'), { recursive: true })
    symlinkSync('missing', path.join(scratch, 'dangle-dir/.claude-plugin'))
    expect(readManifest(path.join(scratch, 'dangle-dir'), scratch)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE when .claude-plugin is a link out of the bound', {
    skip: process.platform === 'win32',
  }, () => {
    mkdirSync(path.join(scratch, 'out-dir'), { recursive: true })
    mkdirSync(path.join(scratch, 'inside/p'), { recursive: true })
    symlinkSync(path.join(scratch, 'out-dir'), path.join(scratch, 'inside/p/.claude-plugin'))
    expect(readManifest(path.join(scratch, 'inside/p'), path.join(scratch, 'inside'))).toBe(
      UNREADABLE,
    )
  })

  it('gives null for a .claude-plugin directory with no plugin.json', () => {
    mkdirSync(path.join(scratch, 'no-file/.claude-plugin'), { recursive: true })
    expect(readManifest(path.join(scratch, 'no-file'), scratch)).toBeNull()
  })

  it('gives null when .claude-plugin is a file, not a directory', () => {
    put('plain/.claude-plugin', 'not a directory')
    expect(readManifest(path.join(scratch, 'plain'), scratch)).toBeNull()
  })
})

describe('repositoryRoot', () => {
  it('gives the first directory at or above that holds .git, or the directory itself', () => {
    put('repo/.git/HEAD', '')
    put('repo/a/b/x.md', '')
    put('wt/.git', 'gitdir: elsewhere')
    put('bare/c/x.md', '')
    expect(repositoryRoot(path.join(scratch, 'repo', 'a', 'b'))).toBe(path.join(scratch, 'repo'))
    expect(repositoryRoot(path.join(scratch, 'repo'))).toBe(path.join(scratch, 'repo'))
    // A `.git` file, as in a worktree or a submodule, counts too.
    expect(repositoryRoot(path.join(scratch, 'wt'))).toBe(path.join(scratch, 'wt'))
    // A directory that does not exist gives its absolute path.
    expect(realDirectory(path.join(scratch, 'repo', 'gone'))).toBe(
      path.join(scratch, 'repo', 'gone'),
    )
    expect(repositoryRoot(path.join(scratch, 'repo', 'gone'))).toBe(path.join(scratch, 'repo'))
  })

  it('gives the directory itself when no directory above holds .git', () => {
    // The scratch directory is in the temporary directory, which no repository holds.
    const free = mkdtempSync(path.join(tmpdir(), 'skill-tree-free-'))
    try {
      expect(repositoryRoot(free)).toBe(realpathSync(free))
    } finally {
      rmSync(free, { recursive: true, force: true })
    }
  })
})

describe('the repository bound', () => {
  it.skipIf(process.platform === 'win32')(
    'does not follow a link out of the bound, and says so',
    () => {
      put('in/repo/.git/HEAD', '')
      put('in/repo/agents/own.md', '')
      put('in/elsewhere/team/far.md', '')
      put('in/elsewhere/far.md', '')
      put('in/elsewhere/s/SKILL.md', '')
      put('in/elsewhere/.claude-plugin/plugin.json', '{"name":"far"}')
      const repo = path.join(scratch, 'in', 'repo')
      symlinkSync('../../elsewhere/team', path.join(repo, 'agents', 'team'))
      symlinkSync('../../elsewhere/far.md', path.join(repo, 'agents', 'far.md'))
      const scan = markdownFiles(path.join(repo, 'agents'), repo)
      expect(scan.files.map((f) => path.relative(repo, f))).toEqual([path.join('agents', 'own.md')])
      expect(scan.outside).toBe(true)
      // A directory that is itself a link out of the bound gives nothing.
      symlinkSync('../elsewhere/team', path.join(repo, 'linked'))
      expect(markdownFiles(path.join(repo, 'linked'), repo)).toEqual({
        files: [],
        outside: true,
        unreadable: false,
      })
      // A skill folder that is a link out of the bound is not a skill of the scope.
      mkdirSync(path.join(repo, 'skills'))
      symlinkSync('../../elsewhere/s', path.join(repo, 'skills', 's'))
      expect(skillFiles(path.join(repo, 'skills'), repo)).toEqual([])
      // A manifest that is a link out of the bound is not read, and the rule cannot see it.
      symlinkSync('../elsewhere/.claude-plugin', path.join(repo, '.claude-plugin'))
      expect(readManifest(repo, repo)).toBe(UNREADABLE)
      expect(readManifest(repo, scratch)).toEqual({ name: 'far' })
    },
  )

  it('takes a bound with a trailing separator, and does not take a sibling with the same prefix', () => {
    put('pre/repo/x.md', '')
    put('pre/repo-other/y.md', '')
    const repo = path.join(scratch, 'pre', 'repo')
    expect(markdownFiles(repo, `${repo}${path.sep}`).files).toEqual([path.join(repo, 'x.md')])
    // The root of the file system is a bound too.
    expect(markdownFiles(repo, path.parse(repo).root).files).toEqual([path.join(repo, 'x.md')])
    expect(markdownFiles(path.join(scratch, 'pre', 'repo-other'), repo)).toEqual({
      files: [],
      outside: true,
      unreadable: false,
    })
  })
})

// A read that fails with `EACCES` is unreadable, and is not a missing file.
describe.skipIf(chmodCannotBlock)('a read that fails', () => {
  it('gives UNREADABLE for a file that cannot be read, and keeps no cache entry for it', () => {
    const file = put('deny/file.md', '---\nname: x\n---\n')
    withoutAccess(file, () => expect(frontmatterOfFile(file)).toBe(UNREADABLE))
    expect(frontmatterOfFile(file)).toEqual({ name: 'x' })
  })

  it('gives UNREADABLE for a manifest when the plugin root cannot be searched', () => {
    put('deny/plugin/.claude-plugin/plugin.json', '{}')
    const root = path.join(scratch, 'deny', 'plugin')
    withoutAccess(root, () => expect(readManifest(root, scratch)).toBe(UNREADABLE))
    expect(readManifest(root, scratch)).toEqual({})
  })

  it('gives a path below a directory that cannot be searched an absolute path as its bound', () => {
    put('deny/anc/sub/.keep', '')
    const dir = path.join(scratch, 'deny', 'anc', 'sub')
    withoutAccess(path.join(scratch, 'deny', 'anc'), () => {
      expect(realDirectory(dir)).toBe(dir)
      expect(repositoryRoot(dir)).toBe(dir)
    })
  })

  it('gives UNREADABLE for a file in a directory that cannot be searched', () => {
    const file = put('deny/dir/file.md', '---\nname: x\n---\n')
    withoutAccess(path.dirname(file), () => {
      expect(frontmatterOfFile(file)).toBe(UNREADABLE)
      expect(statOf(file)).toBe(UNREADABLE)
    })
    expect(statOf(file)).not.toBe(UNREADABLE)
    expect(statOf(path.join(scratch, 'deny', 'none'))).toBeNull()
  })

  it('sets unreadable for a directory that the scan cannot read, and for a nested one', () => {
    put('deny/scan/a.md', '')
    put('deny/scan/sub/b.md', '')
    const sub = path.join(scratch, 'deny', 'scan', 'sub')
    withoutAccess(sub, () => {
      const scan = markdownFiles(path.join(scratch, 'deny', 'scan'), scratch)
      expect(scan.files).toEqual([path.join(scratch, 'deny', 'scan', 'a.md')])
      expect(scan.unreadable).toBe(true)
    })
    withoutAccess(path.join(scratch, 'deny', 'scan'), () => {
      expect(markdownFiles(path.join(scratch, 'deny', 'scan'), scratch)).toEqual({
        files: [],
        outside: false,
        unreadable: true,
      })
      // The path below is unreadable too, because its parent cannot be searched.
      expect(markdownFiles(sub, scratch).unreadable).toBe(true)
    })
  })

  it.skipIf(process.platform === 'win32')(
    'sets unreadable for a link whose target cannot be reached, and not for a dangling link',
    () => {
      put('deny/links/locked/f.md', '')
      mkdirSync(path.join(scratch, 'deny', 'links', 'at'))
      symlinkSync('../../links/locked/f.md', path.join(scratch, 'deny', 'links', 'at', 'f.md'))
      symlinkSync('missing.md', path.join(scratch, 'deny', 'links', 'dangling.md'))
      const dir = path.join(scratch, 'deny', 'links', 'at')
      expect(markdownFiles(dir, scratch).unreadable).toBe(false)
      withoutAccess(path.join(scratch, 'deny', 'links', 'locked'), () => {
        expect(markdownFiles(dir, scratch)).toEqual({ files: [], outside: false, unreadable: true })
      })
      expect(markdownFiles(path.join(scratch, 'deny', 'links'), scratch).unreadable).toBe(false)
    },
  )

  it('lists no skill from a directory or a folder that cannot be read', () => {
    put('deny/sk/a/SKILL.md', '')
    put('deny/sk/b/SKILL.md', '')
    const dir = path.join(scratch, 'deny', 'sk')
    withoutAccess(path.join(dir, 'b'), () => {
      expect(skillFiles(dir, scratch)).toEqual([path.join(dir, 'a', 'SKILL.md')])
    })
    withoutAccess(dir, () => expect(skillFiles(dir, scratch)).toEqual([]))
  })

  it('gives UNREADABLE for a manifest that cannot be read, and null for a missing one', () => {
    const file = put('deny/p/.claude-plugin/plugin.json', '{"name":"p"}')
    const root = path.join(scratch, 'deny', 'p')
    withoutAccess(file, () => expect(readManifest(root, scratch)).toBe(UNREADABLE))
    withoutAccess(path.dirname(file), () => expect(readManifest(root, scratch)).toBe(UNREADABLE))
    expect(readManifest(root, scratch)).toEqual({ name: 'p' })
    expect(readManifest(path.join(scratch, 'deny', 'no-plugin'), scratch)).toBeNull()
  })
})
