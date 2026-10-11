// The matcher for the `paths` globs of a rule file. The forms in the docs are the first cases
// (https://code.claude.com/docs/en/memory#path-specific-rules). The rest are the choices of the
// matcher where the docs are silent.
import { describe, expect, it } from 'vitest'
import { unmatchedGlobs } from '../src/glob-match.ts'
import { tree } from './marketplace-tree.test-support.ts'

/** True when the glob matches the file, or a folder above it, in a tree that holds the file. */
function hit(glob: string, file: string) {
  const dir = tree({ [file]: 'x\n' }, false)
  return unmatchedGlobs(dir, dir, [glob])?.length === 0
}

describe('unmatchedGlobs', () => {
  it('matches every file for a glob that names the project root', () => {
    expect(hit('./', 'src/a.ts')).toBe(true)
    expect(hit('/', 'a.ts')).toBe(true)
  })

  it('does not build an expression for a reversed range, and so does not throw', () => {
    const dir = tree({ 'b.ts': 'x\n' }, false)
    expect(unmatchedGlobs(dir, dir, ['[z-a].ts'])).toEqual([])
  })

  it('gives null for a root that is not there and a glob is left', () => {
    const dir = tree({ 'b.ts': 'x\n' }, false)
    const gone = `${dir}/none`
    expect(unmatchedGlobs(gone, dir, ['*.ts'])).toBeNull()
  })

  it('matches the forms in the docs', () => {
    expect(hit('**/*.ts', 'a.ts')).toBe(true)
    expect(hit('**/*.ts', 'src/deep/a.ts')).toBe(true)
    expect(hit('src/**/*', 'src/a.ts')).toBe(true)
    expect(hit('src/**/*', 'lib/a.ts')).toBe(false)
    expect(hit('*.md', 'README.md')).toBe(true)
    expect(hit('*.md', 'docs/README.md')).toBe(false)
    expect(hit('src/components/*.tsx', 'src/components/B.tsx')).toBe(true)
    expect(hit('src/components/*.tsx', 'src/components/x/B.tsx')).toBe(false)
    expect(hit('src/**/*.{ts,tsx}', 'src/a/B.tsx')).toBe(true)
    expect(hit('src/**/*.{ts,tsx}', 'src/a/B.js')).toBe(false)
  })

  it('reads a double star only as a whole part', () => {
    expect(hit('src/**', 'src/a/b.ts')).toBe(true)
    expect(hit('a**b', 'axxb')).toBe(true)
    expect(hit('a**b', 'ax/xb')).toBe(false)
    expect(hit('**/x.ts', 'x.ts')).toBe(true)
    expect(hit('a/**/x.ts', 'a/x.ts')).toBe(true)
    expect(hit('a/**/x.ts', 'a/b/c/x.ts')).toBe(true)
  })

  it('matches a folder and the files below it', () => {
    expect(hit('src/api', 'src/api/users.ts')).toBe(true)
    expect(hit('src/api/', 'src/api/users.ts')).toBe(true)
    expect(hit('src/api', 'src/apis/users.ts')).toBe(false)
    expect(hit('./src', 'src/a.ts')).toBe(true)
    expect(hit('/src', 'src/a.ts')).toBe(true)
  })

  it('reads ?, brackets and braces', () => {
    expect(hit('a?.ts', 'ab.ts')).toBe(true)
    expect(hit('a?.ts', 'a/.ts')).toBe(false)
    expect(hit('[ab].ts', 'a.ts')).toBe(true)
    expect(hit('[!ab].ts', 'a.ts')).toBe(false)
    expect(hit('[^ab].ts', 'c.ts')).toBe(true)
    expect(hit('[]a].ts', ']'.concat('.ts'))).toBe(true)
    expect(hit('[a\\]b].ts', ']'.concat('.ts'))).toBe(true)
    expect(hit('[a-c].ts', 'b.ts')).toBe(true)
    expect(hit('[[].ts', '['.concat('.ts'))).toBe(true)
    expect(hit('{a,b{c,d}}.ts', 'bd.ts')).toBe(true)
    expect(hit('{a,b{c,d}}.ts', 'b.ts')).toBe(false)
  })

  it('keeps an unclosed bracket and an unclosed or comma-free brace as text', () => {
    expect(hit('[a.ts', '[a.ts')).toBe(true)
    expect(hit('[a\\', '[a\\')).toBe(true)
    expect(hit('{a.ts', '{a.ts')).toBe(true)
    expect(hit('{a}.ts', '{a}.ts')).toBe(true)
    expect(hit('{a}.ts', 'a.ts')).toBe(false)
    expect(hit('{a\\,b}.ts', '{a,b}.ts')).toBe(true)
  })

  it('reads a backslash as an escape, also at the end', () => {
    expect(hit('a\\*.ts', 'a*.ts')).toBe(true)
    expect(hit('a\\*.ts', 'ab.ts')).toBe(false)
    expect(hit('a\\n', 'an')).toBe(true)
    expect(hit('a\\', 'a\\')).toBe(true)
    expect(hit('{a\\,b,c}', 'a,b')).toBe(true)
    expect(hit('{a\\},b}', 'a}')).toBe(true)
  })

  it('matches a dot file and escapes the characters of a regular expression', () => {
    expect(hit('*', '.hidden')).toBe(true)
    expect(hit('.github/**', '.github/ci.yml')).toBe(true)
    expect(hit('a+b(1).ts', 'a+b(1).ts')).toBe(true)
    expect(hit('a.b', 'axb')).toBe(false)
  })
})
