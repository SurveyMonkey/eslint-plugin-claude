// The files around a skill: the scope root, frontmatter read from text and
// from a file, the Markdown files below a directory, and the plugin manifest.
import { execFileSync, spawnSync } from 'node:child_process'
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
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { readSettings } from '../src/settings-files.ts'
import { classifySkillFile } from '../src/skill-files.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  readJson,
  readManifest,
  realDirectory,
  repositoryRoot,
  scopeRoot,
  skillFiles,
  skillScan,
  statOf,
  UNREADABLE,
} from '../src/skill-tree.ts'
import { chmodCannotBlock, withoutAccess } from './rule-tester.test-support.ts'

// A `statSync` can fail after `realpathSync` resolves the same path. A process can remove the
// file between the two calls. No tree on disk gives that order, so the wrapper below
// makes `statSync` fail with the code in `faults` for that path. It also makes `realpathSync`
// give the path in `realpaths` for a path that is not on disk, once. A later call sees the disk,
// as after the race. Each other call goes to the real function.
const faults = vi.hoisted(() => new Map<string, string>())
const realpaths = vi.hoisted(() => new Map<string, string>())
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const statSync = (...args: unknown[]) => {
    const code = faults.get(String(args[0]))
    if (code !== undefined) {
      throw Object.assign(new Error(`${code}: stat '${String(args[0])}'`), { code })
    }
    return (actual.statSync as (...rest: unknown[]) => unknown)(...args)
  }
  const realpathSync = Object.assign(
    (...args: unknown[]) => {
      const real = realpaths.get(String(args[0]))
      realpaths.delete(String(args[0]))
      return real ?? (actual.realpathSync as (...rest: unknown[]) => unknown)(...args)
    },
    { native: actual.realpathSync.native },
  )
  return {
    ...actual,
    statSync,
    realpathSync,
    default: { ...actual, statSync, realpathSync },
  }
})

// The system tool that makes a FIFO. Node has no call for it.
const MAKE_FIFO = 'mkfifo'

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

// A dangling link can lead anywhere, so the scan cannot see what is behind it (ADR 001,
// Decision 14). The scan keeps the files that it found, and sets `unreadable`.
describe('markdownFiles and a link with no target', () => {
  it.skipIf(process.platform === 'win32')('sets unreadable for a dangling link in the walk', () => {
    put('dl/a.md', '')
    put('dl/sub/b.md', '')
    const dir = path.join(scratch, 'dl')
    const found = [path.join(dir, 'a.md'), path.join(dir, 'sub', 'b.md')]
    expect(markdownFiles(dir, scratch)).toEqual({ files: found, outside: false, unreadable: false })
    symlinkSync('missing.md', path.join(dir, 'sub', 'gone.md'))
    expect(markdownFiles(dir, scratch)).toEqual({ files: found, outside: false, unreadable: true })
    // A dangling link with no `.md` name can be a directory, so it sets `unreadable` too.
    put('dl2/a.md', '')
    symlinkSync('missing', path.join(scratch, 'dl2', 'team'))
    expect(markdownFiles(path.join(scratch, 'dl2'), scratch)).toEqual({
      files: [path.join(scratch, 'dl2', 'a.md')],
      outside: false,
      unreadable: true,
    })
  })

  it.skipIf(process.platform === 'win32')(
    'sets unreadable when the directory is a dangling link, or is below one',
    () => {
      mkdirSync(path.join(scratch, 'dr'), { recursive: true })
      symlinkSync('missing', path.join(scratch, 'dr', 'agents'))
      const unseen = { files: [], outside: false, unreadable: true }
      expect(markdownFiles(path.join(scratch, 'dr', 'agents'), scratch)).toEqual(unseen)
      expect(markdownFiles(path.join(scratch, 'dr', 'agents', 'team'), scratch)).toEqual(unseen)
      // A missing directory with no link in its path is not there, and the scan sees that.
      expect(markdownFiles(path.join(scratch, 'dr', 'none'), scratch)).toEqual({
        files: [],
        outside: false,
        unreadable: false,
      })
    },
  )

  // A missing directory out of the bound can be there. The scan cannot see out of the bound
  // (ADR 001, Decision 14), so it sets `outside`.
  it('sets outside for a missing directory out of the bound, with no link in its path', () => {
    put('db/in/a.md', '')
    expect(markdownFiles(path.join(scratch, 'db', 'gone'), path.join(scratch, 'db', 'in'))).toEqual(
      { files: [], outside: true, unreadable: false },
    )
    // A missing directory below the bound is not there, and the scan sees that.
    expect(
      markdownFiles(path.join(scratch, 'db', 'in', 'gone'), path.join(scratch, 'db', 'in')),
    ).toEqual({ files: [], outside: false, unreadable: false })
    // The same holds when a file in the path stops the walk up.
    expect(
      markdownFiles(path.join(scratch, 'db', 'in', 'a.md', 'gone'), path.join(scratch, 'db', 'in')),
    ).toEqual({ files: [], outside: false, unreadable: false })
  })

  it.skipIf(process.platform === 'win32')(
    'sets outside for a missing directory below a link out of the bound',
    () => {
      put('lo/repo/.git/HEAD', '')
      put('lo/elsewhere/team/far.md', '')
      const repo = path.join(scratch, 'lo', 'repo')
      symlinkSync('../elsewhere', path.join(repo, '.claude'))
      // The target has no `agents` folder, and the link leads out of the bound.
      expect(markdownFiles(path.join(repo, '.claude', 'agents'), repo)).toEqual({
        files: [],
        outside: true,
        unreadable: false,
      })
      // The bound of the target itself holds the path, so the folder is not there.
      expect(
        markdownFiles(path.join(repo, '.claude', 'agents'), path.join(scratch, 'lo', 'elsewhere')),
      ).toEqual({ files: [], outside: false, unreadable: false })
    },
  )

  it.skipIf(process.platform === 'win32')(
    'sets unreadable, not outside, for a dangling link in the path of a directory out of the bound',
    () => {
      put('ld/in/a.md', '')
      mkdirSync(path.join(scratch, 'ld', 'out'), { recursive: true })
      symlinkSync('missing', path.join(scratch, 'ld', 'out', 'agents'))
      expect(
        markdownFiles(
          path.join(scratch, 'ld', 'out', 'agents', 'team'),
          path.join(scratch, 'ld', 'in'),
        ),
      ).toEqual({ files: [], outside: false, unreadable: true })
      expect(
        markdownFiles(path.join(scratch, 'ld', 'out', 'agents'), path.join(scratch, 'ld', 'in')),
      ).toEqual({ files: [], outside: false, unreadable: true })
    },
  )
})

describe('markdownFiles when a stat fails', () => {
  it.skipIf(process.platform === 'win32')(
    'sets unreadable for a link whose target fails to stat, and does not throw',
    () => {
      const target = put('sf/target.md', '')
      symlinkSync('target.md', path.join(scratch, 'sf', 'link.md'))
      const dir = path.join(scratch, 'sf')
      expect(markdownFiles(dir, scratch)).toEqual({
        files: [target, path.join(dir, 'link.md')],
        outside: false,
        unreadable: false,
      })
      for (const code of ['EACCES', 'ENOENT']) {
        faults.set(target, code)
        try {
          expect(markdownFiles(dir, scratch)).toEqual({
            files: [target],
            outside: false,
            unreadable: true,
          })
        } finally {
          faults.clear()
        }
      }
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

// `skipped` is true when the scan leaves out a skill that it cannot see. The cases that follow
// each change one input. Each `SKILL.md` that is a link needs a platform that has links.
describe('skillScan', () => {
  const scan = (dir: string) => skillScan(path.join(scratch, dir), scratch)
  const names = (dir: string) =>
    scan(dir).files.map((f) => path.relative(path.join(scratch, dir), f).split(path.sep).join('/'))

  it('sets skipped for nothing that holds no skill', () => {
    put('sc-ok/a/SKILL.md', '')
    mkdirSync(path.join(scratch, 'sc-ok/empty'), { recursive: true })
    put('sc-ok/file.md', '')
    expect(scan('sc-ok')).toEqual({
      files: [path.join(scratch, 'sc-ok/a/SKILL.md')],
      skipped: false,
    })
    expect(scan('sc-none')).toEqual({ files: [], skipped: false })
    put('sc-file', 'not a folder')
    expect(scan('sc-file')).toEqual({ files: [], skipped: false })
  })

  it.skipIf(process.platform === 'win32')('sets skipped for a link that holds no skill', () => {
    put('sc-lnk/a/SKILL.md', '')
    mkdirSync(path.join(scratch, 'sc-shared/empty'), { recursive: true })
    put('sc-shared/notes.md', '')
    symlinkSync('../sc-shared/empty', path.join(scratch, 'sc-lnk/folder'))
    symlinkSync('../sc-shared/notes.md', path.join(scratch, 'sc-lnk/notes.md'))
    expect(scan('sc-lnk').skipped).toBe(false)
    expect(names('sc-lnk')).toEqual(['a/SKILL.md'])
  })

  it.skipIf(process.platform === 'win32')('sets skipped for a link to nothing', () => {
    // The entry is a link to nothing.
    mkdirSync(path.join(scratch, 'sc-dead'), { recursive: true })
    symlinkSync('missing', path.join(scratch, 'sc-dead/x'))
    expect(scan('sc-dead')).toEqual({ files: [], skipped: true })
    // The `SKILL.md` is a link to nothing, in a real folder.
    mkdirSync(path.join(scratch, 'sc-dead2/x'), { recursive: true })
    symlinkSync('missing', path.join(scratch, 'sc-dead2/x/SKILL.md'))
    expect(scan('sc-dead2')).toEqual({ files: [], skipped: true })
    // The directory is a link to nothing.
    symlinkSync('missing', path.join(scratch, 'sc-dead3'))
    expect(scan('sc-dead3')).toEqual({ files: [], skipped: true })
  })

  it.skipIf(process.platform === 'win32')('sets skipped for a link out of the bound', () => {
    put('sc-out-target/x/SKILL.md', '')
    mkdirSync(path.join(scratch, 'sc-bounded/inside'), { recursive: true })
    symlinkSync(path.join(scratch, 'sc-out-target/x'), path.join(scratch, 'sc-bounded/inside/x'))
    const bound = path.join(scratch, 'sc-bounded')
    expect(skillScan(path.join(bound, 'inside'), bound)).toEqual({ files: [], skipped: true })
  })

  describe.skipIf(chmodCannotBlock)('without access', () => {
    it('sets skipped for a directory that the rule cannot list', () => {
      put('sc-lock/a/SKILL.md', '')
      withoutAccess(path.join(scratch, 'sc-lock'), () =>
        expect(scan('sc-lock')).toEqual({ files: [], skipped: true }),
      )
    })

    it('sets skipped for a skill folder that the rule cannot search', () => {
      put('sc-lock2/a/SKILL.md', '')
      withoutAccess(path.join(scratch, 'sc-lock2/a'), () =>
        expect(scan('sc-lock2')).toEqual({ files: [], skipped: true }),
      )
    })
  })
})

describe('readManifest', () => {
  it('reads an object, and gives null for a missing file', () => {
    expect(readManifest(plugin, scratch)).toEqual({ name: 'p', skills: './extra' })
    expect(readManifest(path.join(scratch, 'none'), scratch)).toBeNull()
  })
})

describe('readManifest on a file that does not parse to an object', () => {
  it.each([
    ['a syntax error', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a scalar', '3'],
  ])('gives UNREADABLE for %s', (_name, text) => {
    const root = path.join(scratch, `bad-${Buffer.from(text).toString('hex')}`)
    put(`${path.basename(root)}/.claude-plugin/plugin.json`, text)
    expect(readManifest(root, scratch)).toBe(UNREADABLE)
  })
})

describe('readManifest on a link', () => {
  it.skipIf(process.platform === 'win32')(
    'gives UNREADABLE when plugin.json is a dangling link',
    () => {
      mkdirSync(path.join(scratch, 'dangle/.claude-plugin'), { recursive: true })
      symlinkSync('missing.json', path.join(scratch, 'dangle/.claude-plugin/plugin.json'))
      expect(readManifest(path.join(scratch, 'dangle'), scratch)).toBe(UNREADABLE)
    },
  )

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

  it('reads plugin.json when .claude-plugin is a link inside the bound', {
    skip: process.platform === 'win32',
  }, () => {
    mkdirSync(path.join(scratch, 'in-dir'), { recursive: true })
    writeFileSync(path.join(scratch, 'in-dir/plugin.json'), '{"name":"x"}')
    mkdirSync(path.join(scratch, 'in-p'), { recursive: true })
    symlinkSync(path.join(scratch, 'in-dir'), path.join(scratch, 'in-p/.claude-plugin'))
    expect(readManifest(path.join(scratch, 'in-p'), scratch)).toEqual({ name: 'x' })
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

describe('readJson', () => {
  it('parses a file in the bound', () => {
    put('rj/in/a.json', '{"a":1}')
    expect(readJson(path.join(scratch, 'rj/in/a.json'), path.join(scratch, 'rj/in'))).toEqual({
      data: { a: 1 },
    })
  })

  it('gives null for a missing file in the bound', () => {
    put('rj/in/x', '')
    const bound = path.join(scratch, 'rj/in')
    expect(readJson(path.join(bound, 'gone.json'), bound)).toBeNull()
    // A missing directory in the bound is a missing file too.
    expect(readJson(path.join(bound, 'gone/deep/gone.json'), bound)).toBeNull()
    // A file below a file is not there.
    expect(readJson(path.join(bound, 'x/gone.json'), bound)).toBeNull()
  })

  it('gives UNREADABLE for a missing file out of the bound', () => {
    put('rj/in/x', '')
    put('rj/out/x', '')
    const bound = path.join(scratch, 'rj/in')
    expect(readJson(path.join(scratch, 'rj/out/gone.json'), bound)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a missing file below a missing directory out of the bound', () => {
    put('rj/in/x', '')
    put('rj/out/x', '')
    const bound = path.join(scratch, 'rj/in')
    expect(readJson(path.join(scratch, 'rj/out/gone/deep/gone.json'), bound)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a real file out of the bound', () => {
    put('rj/in/x', '')
    put('rj/out/real.json', '{}')
    expect(readJson(path.join(scratch, 'rj/out/real.json'), path.join(scratch, 'rj/in'))).toBe(
      UNREADABLE,
    )
  })

  it.skipIf(process.platform === 'win32')('gives UNREADABLE for a dangling link', () => {
    put('rj/in/x', '')
    put('rj/out/x', '')
    const bound = path.join(scratch, 'rj/in')
    symlinkSync('gone.json', path.join(bound, 'dangling.json'))
    symlinkSync('../out/gone.json', path.join(bound, 'far.json'))
    expect(readJson(path.join(bound, 'dangling.json'), bound)).toBe(UNREADABLE)
    expect(readJson(path.join(bound, 'far.json'), bound)).toBe(UNREADABLE)
  })

  it('gives UNREADABLE for a missing file below a link out of the bound', {
    skip: process.platform === 'win32',
  }, () => {
    put('rj/in/x', '')
    put('rj/out/x', '')
    const bound = path.join(scratch, 'rj/in')
    symlinkSync('../out', path.join(bound, 'out-link'))
    expect(readJson(path.join(bound, 'out-link/gone.json'), bound)).toBe(UNREADABLE)
  })

  it('gives null for a missing file when the bound does not exist', () => {
    put('rj/out/x', '')
    const bound = path.join(scratch, 'rj/nobound')
    expect(readJson(path.join(bound, 'gone.json'), bound)).toBeNull()
    expect(readJson(path.join(bound, 'a/b/gone.json'), bound)).toBeNull()
    expect(readJson(path.join(scratch, 'rj/out/gone.json'), bound)).toBe(UNREADABLE)
  })

  it.skipIf(process.platform === 'win32')(
    'gives null for a missing file below a link to a directory in the bound',
    () => {
      put('rj/in/sub/x', '')
      const bound = path.join(scratch, 'rj/in')
      symlinkSync('sub', path.join(bound, 'in-link'))
      expect(readJson(path.join(bound, 'in-link/gone.json'), bound)).toBeNull()
    },
  )

  it.skipIf(process.platform === 'win32')(
    'gives UNREADABLE for a missing file below a dangling directory link, whatever its target',
    () => {
      put('rj/in/x', '')
      put('rj/out/x', '')
      const bound = path.join(scratch, 'rj/in')
      symlinkSync('../out/nothing', path.join(bound, 'dl-out'))
      symlinkSync('nothing', path.join(bound, 'dl-in'))
      expect(readJson(path.join(bound, 'dl-out/gone.json'), bound)).toBe(UNREADABLE)
      expect(readJson(path.join(bound, 'dl-out/deep/gone.json'), bound)).toBe(UNREADABLE)
      expect(readJson(path.join(bound, 'dl-in/gone.json'), bound)).toBe(UNREADABLE)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'resolves a .. part before a link, as realpath does',
    () => {
      put('rj/in/x', '')
      put('rj/out/x', '')
      const bound = path.join(scratch, 'rj/in')
      symlinkSync('../out', path.join(bound, 'dotted'))
      expect(readJson(path.join(bound, 'dotted/../gone.json'), bound)).toBeNull()
      expect(readJson(path.join(bound, 'dotted/gone.json'), bound)).toBe(UNREADABLE)
    },
  )
})

describe('readJson when a stat fails', () => {
  it('gives UNREADABLE for a failed stat of a file', () => {
    const file = put('rs/a.json', '{"a":1}')
    faults.set(file, 'EACCES')
    try {
      expect(readJson(file, scratch)).toBe(UNREADABLE)
    } finally {
      faults.clear()
    }
    expect(readJson(file, scratch)).toEqual({ data: { a: 1 } })
  })

  it('gives null for a file that a process removed after the real path resolved', () => {
    // The file is not on disk. `realpaths` makes the real path resolve, as before the process
    // removed the file.
    const file = path.join(scratch, 'rs', 'removed.json')
    realpaths.set(file, file)
    try {
      expect(readJson(file, scratch)).toBeNull()
    } finally {
      realpaths.clear()
    }
    // Without the wrapper, the file is not there, and the result is the same.
    expect(readJson(file, scratch)).toBeNull()
  })

  it.skipIf(process.platform === 'win32')(
    'gives UNREADABLE for a link whose target a process removed after the real path resolved',
    () => {
      // The link has no target on disk. `realpaths` makes it resolve, as before the process
      // removed the target.
      const target = path.join(scratch, 'rs', 'target.json')
      const link = path.join(scratch, 'rs', 'link.json')
      symlinkSync('target.json', link)
      realpaths.set(link, target)
      try {
        expect(readJson(link, scratch)).toBe(UNREADABLE)
      } finally {
        realpaths.clear()
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'gives UNREADABLE for a file below a link whose target a process removed',
    () => {
      // A link in the path, not the file, loses its target during the read.
      mkdirSync(path.join(scratch, 'rp'), { recursive: true })
      symlinkSync('cfg', path.join(scratch, 'rp', 'dot'))
      const file = path.join(scratch, 'rp', 'dot', 'a.json')
      realpaths.set(file, path.join(scratch, 'rp', 'cfg', 'a.json'))
      try {
        expect(readJson(file, scratch)).toBe(UNREADABLE)
      } finally {
        realpaths.clear()
      }
    },
  )
})

// Claude Code 2.1.246 and later loads a `plugin.json` that starts with a byte order mark (the
// 2.1.246 entry of https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).
describe('readJson and a byte order mark', () => {
  it('parses the text after a leading mark', () => {
    const bound = path.join(scratch, 'bom')
    expect(readJson(put('bom/a.json', '\u{FEFF}{"a":1}'), bound)).toEqual({ data: { a: 1 } })
    // A mark at another place is text that does not parse.
    expect(readJson(put('bom/end.json', '{"a":1}\u{FEFF}'), bound)).toEqual({ data: undefined })
    expect(readJson(put('bom/two.json', '\u{FEFF}\u{FEFF}{}'), bound)).toEqual({ data: undefined })
  })

  it('reads the keys of a plugin.json with a leading mark', () => {
    put('bom-p/.claude-plugin/plugin.json', '\u{FEFF}{"name":"p","skills":"./extra"}')
    expect(readManifest(path.join(scratch, 'bom-p'), scratch)).toEqual({
      name: 'p',
      skills: './extra',
    })
  })
})

// A read of a path that is not a regular file gives UNREADABLE. A FIFO is the case that
// matters: a read of it waits for a writer, and stops the lint run.
describe('a path that is not a regular file', () => {
  it('reads a regular file, and gives UNREADABLE for a directory', () => {
    expect(readJson(put('special/a.json', '{"a":1}'), scratch)).toEqual({ data: { a: 1 } })
    expect(frontmatterOfFile(put('special/a.md', '---\nname: a\n---\n'))).toEqual({ name: 'a' })
    mkdirSync(path.join(scratch, 'special', 'dir.json'))
    expect(readJson(path.join(scratch, 'special', 'dir.json'), scratch)).toBe(UNREADABLE)
    expect(frontmatterOfFile(path.join(scratch, 'special', 'dir.json'))).toBe(UNREADABLE)
  })

  it.skipIf(process.platform === 'win32')('gives UNREADABLE for a device', () => {
    expect(readJson('/dev/null', '/dev')).toBe(UNREADABLE)
    expect(frontmatterOfFile('/dev/null')).toBe(UNREADABLE)
  })

  // A read that waits on the FIFO blocks the thread, and a test timeout cannot stop it. So a
  // child process does the read, and `spawnSync` stops the child at its own timeout.
  it('gives UNREADABLE for a FIFO, and does not wait for a writer', {
    skip: process.platform === 'win32',
    timeout: 30_000,
  }, () => {
    mkdirSync(path.join(scratch, 'fifo'), { recursive: true })
    const fifo = path.join(scratch, 'fifo', 'pipe.md')
    execFileSync(MAKE_FIFO, [fifo])
    const source = pathToFileURL(path.join(import.meta.dirname, '../src/skill-tree.ts')).href
    const probe = [
      `import { frontmatterOfFile, readJson } from ${JSON.stringify(source)}`,
      'const [fifo, bound] = process.argv.slice(1)',
      'console.log(JSON.stringify([frontmatterOfFile(fifo), readJson(fifo, bound)].map(String)))',
    ].join('\n')
    // Node 22.13 to 22.17 needs the flag to import a .ts file.
    const flags = process.features.typescript ? [] : ['--experimental-strip-types']
    const args = [...flags, '--input-type=module', '-e', probe, fifo, scratch]
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10_000 })
    expect(child.signal).toBeNull()
    expect(child.status, child.stderr).toBe(0)
    expect(child.stdout.trim()).toBe('["Symbol(unreadable)","Symbol(unreadable)"]')
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

describe('realDirectory for a bound that is not there', () => {
  // The parent of the bound is a link, as /var is on macOS. The test makes its own link.
  const linked = (name: string) => {
    put(`${name}/target/.keep`, '')
    symlinkSync(path.join(scratch, name, 'target'), path.join(scratch, name, 'link'))
    return path.join(scratch, name)
  }

  it('gives the real path of the nearest part that exists, plus the rest', () => {
    const base = linked('missing-bound')
    const bound = path.join(base, 'link', 'gone', 'deeper')
    expect(realDirectory(bound)).toBe(path.join(base, 'target', 'gone', 'deeper'))
    expect(repositoryRoot(bound)).toBe(path.join(base, 'target', 'gone', 'deeper'))
  })

  it('does not set outside for a scan in a bound that is not there', () => {
    const base = linked('missing-scan')
    const bound = path.join(base, 'link', 'gone')
    expect(markdownFiles(path.join(bound, 'agents'), realDirectory(bound))).toEqual({
      files: [],
      outside: false,
      unreadable: false,
    })
  })

  it('sets outside when the nearest part that exists is out of the bound', () => {
    const base = linked('missing-out')
    const bound = realDirectory(path.join(base, 'target', 'inner'))
    expect(markdownFiles(path.join(base, 'link', 'gone'), bound).outside).toBe(true)
  })
})

describe('repositoryRoot for a linked .claude', () => {
  it('gives the repository, not the link target, and readSettings gives UNREADABLE', {
    skip: process.platform === 'win32',
  }, () => {
    put('lrepo/.git/HEAD', '')
    put('loutside/settings.json', '{"model":"opus"}')
    symlinkSync('../loutside', path.join(scratch, 'lrepo/.claude'))
    const dir = path.join(scratch, 'lrepo/.claude')
    expect(repositoryRoot(dir)).toBe(path.join(scratch, 'lrepo'))
    expect(readSettings(dir, repositoryRoot(dir))).toBe(UNREADABLE)
  })

  it.skipIf(process.platform === 'win32')(
    'gives the real path of a repository reached by a link',
    () => {
      put('rrepo/.git/HEAD', '')
      put('rrepo/.claude/settings.json', '{"model":"opus"}')
      symlinkSync('rrepo', path.join(scratch, 'rlink'))
      const dir = path.join(scratch, 'rlink/.claude')
      expect(repositoryRoot(dir)).toBe(path.join(scratch, 'rrepo'))
      expect(readSettings(dir, repositoryRoot(dir))).toEqual({ model: 'opus' })
    },
  )

  it('gives the repository for a .claude below a directory link out of it', {
    skip: process.platform === 'win32',
  }, () => {
    put('irepo/.git/HEAD', '')
    put('ioutside/.claude/settings.json', '{"model":"opus"}')
    symlinkSync('../ioutside', path.join(scratch, 'irepo/link'))
    const dir = path.join(scratch, 'irepo/link/.claude')
    expect(repositoryRoot(dir)).toBe(path.join(scratch, 'irepo'))
    expect(readSettings(dir, repositoryRoot(dir))).toBe(UNREADABLE)
  })

  // ADR 001 Decision 14: the repository is the first directory at or above the
  // file that has a `.git` entry. A link target with its own `.git` is such a directory.
  it('gives the link target when the target holds its own .git', {
    skip: process.platform === 'win32',
  }, () => {
    put('grepo/.git/HEAD', '')
    put('goutside/.git/HEAD', '')
    put('goutside/settings.json', '{"model":"opus"}')
    symlinkSync('../goutside', path.join(scratch, 'grepo/.claude'))
    const dir = path.join(scratch, 'grepo/.claude')
    expect(repositoryRoot(dir)).toBe(path.join(scratch, 'goutside'))
    expect(readSettings(dir, repositoryRoot(dir))).toEqual({ model: 'opus' })
  })

  it('gives the real path of a linked directory when no directory above holds .git', {
    skip: process.platform === 'win32',
  }, () => {
    const free = realpathSync(mkdtempSync(path.join(tmpdir(), 'skill-tree-nogit-')))
    try {
      mkdirSync(path.join(free, 'target'))
      symlinkSync('target', path.join(free, 'link'))
      expect(repositoryRoot(path.join(free, 'link'))).toBe(path.join(free, 'target'))
    } finally {
      rmSync(free, { recursive: true, force: true })
    }
  })

  it('gives the target of a .claude link when no directory above holds .git', {
    skip: process.platform === 'win32',
  }, () => {
    const free = realpathSync(mkdtempSync(path.join(tmpdir(), 'skill-tree-nogit-')))
    try {
      mkdirSync(path.join(free, 'target'))
      writeFileSync(path.join(free, 'target/settings.json'), '{"model":"opus"}')
      symlinkSync('target', path.join(free, '.claude'))
      const dir = path.join(free, '.claude')
      expect(repositoryRoot(dir)).toBe(path.join(free, 'target'))
      expect(readSettings(dir, repositoryRoot(dir))).toEqual({ model: 'opus' })
    } finally {
      rmSync(free, { recursive: true, force: true })
    }
  })

  it('reads a .claude that is a real directory', () => {
    put('drepo/.git/HEAD', '')
    put('drepo/.claude/settings.json', '{"model":"opus"}')
    const dir = path.join(scratch, 'drepo/.claude')
    expect(repositoryRoot(dir)).toBe(path.join(scratch, 'drepo'))
    expect(readSettings(dir, repositoryRoot(dir))).toEqual({ model: 'opus' })
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
    'sets unreadable for a link whose target cannot be reached, and for a dangling link',
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
      // A dangling link can lead anywhere, so the scan cannot see what is behind it.
      expect(markdownFiles(path.join(scratch, 'deny', 'links'), scratch).unreadable).toBe(true)
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
