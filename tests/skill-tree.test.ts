// The files around a skill: the scope root, frontmatter read from text and
// from a file, the Markdown files below a directory, and the plugin manifest.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { classifySkillFile } from '../src/skill-files.ts'
import { frontmatterOfFile, markdownFiles, readManifest, scopeRoot } from '../src/skill-tree.ts'

const scratch = mkdtempSync(path.join(tmpdir(), 'skill-tree-'))
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
const frontmatterOf = (text: string) => frontmatterOfFile(put('text.md', text))

describe('frontmatterOf', () => {
  it('reads the block on line 1', () => {
    expect(frontmatterOf('---\nname: a\n---\n# A\n')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\r\nname: a\r\n---\r\n# A\r\n')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\nname: a\n---')).toEqual({ name: 'a' })
    expect(frontmatterOf('---\nname: a\n---  \n# A\n')).toEqual({ name: 'a' })
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
  })
})

describe('frontmatterOfFile', () => {
  it('reads a file, and gives null for a missing file', () => {
    expect(frontmatterOfFile(put('a/x.md', '---\nname: x\n---\n'))).toEqual({ name: 'x' })
    expect(frontmatterOfFile(path.join(scratch, 'a', 'none.md'))).toBeNull()
  })
})

describe('markdownFiles', () => {
  it('lists .md files at any depth in name order, and nothing for a missing directory', () => {
    put('tree/Z.md', '')
    put('tree/b.md', '')
    put('tree/a/c.md', '')
    put('tree/a/d.txt', '')
    put('tree/a/e/f.md', '')
    const rel = markdownFiles(path.join(scratch, 'tree')).map((f) =>
      path.relative(path.join(scratch, 'tree'), f).split(path.sep).join('/'),
    )
    expect(rel).toEqual(['a/c.md', 'a/e/f.md', 'b.md', 'Z.md'])
    expect(markdownFiles(path.join(scratch, 'none'))).toEqual([])
  })
})

describe('readManifest', () => {
  it('reads an object, and gives null for a missing, bad or non-object file', () => {
    expect(readManifest(plugin)).toEqual({ name: 'p', skills: './extra' })
    expect(readManifest(path.join(scratch, 'none'))).toBeNull()
    put('m1/.claude-plugin/plugin.json', '{')
    expect(readManifest(path.join(scratch, 'm1'))).toBeNull()
    put('m2/.claude-plugin/plugin.json', '[]')
    expect(readManifest(path.join(scratch, 'm2'))).toBeNull()
    put('m4/.claude-plugin/plugin.json', '3')
    expect(readManifest(path.join(scratch, 'm4'))).toBeNull()
    put('m3/.claude-plugin/plugin.json', 'null')
    expect(readManifest(path.join(scratch, 'm3'))).toBeNull()
  })
})
