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
    expect(hit('*.md', 'docs/README.md')).toBe(true)
    expect(hit('/*.md', 'README.md')).toBe(true)
    expect(hit('/*.md', 'docs/README.md')).toBe(false)
    expect(hit('src/components/*.tsx', 'src/components/B.tsx')).toBe(true)
    expect(hit('src/components/*.tsx', 'src/components/x/B.tsx')).toBe(false)
    expect(hit('src/**/*.{ts,tsx}', 'src/a/B.tsx')).toBe(true)
    expect(hit('src/**/*.{ts,tsx}', 'src/a/B.js')).toBe(false)
  })

  it('matches a glob with no slash at any depth, and anchors a glob that has a slash', () => {
    // Path-specific rules: `*.md` is ".md files anywhere under the base directory". `/*.md` is
    // ".md files directly in the base directory, not in subfolders".
    expect(hit('*.md', 'a/b/c/README.md')).toBe(true)
    expect(hit('*.md', 'README.txt')).toBe(false)
    expect(hit('README.md', 'docs/README.md')).toBe(true)
    expect(hit('/*.md', 'a/b/README.md')).toBe(false)
    expect(hit('./*.md', 'docs/README.md')).toBe(false)
    expect(hit('./*.md', 'README.md')).toBe(true)
    expect(hit('docs/*.md', 'a/docs/README.md')).toBe(false)
    expect(hit('docs/*.md', 'docs/README.md')).toBe(true)
    expect(hit('src/components/*.tsx', 'a/src/components/B.tsx')).toBe(false)
    // A name at any depth starts after a `/`, not inside a name.
    expect(hit('README.md', 'docsREADME.md')).toBe(false)
  })

  it('does not anchor a glob for a / at the end or a / in a brace group with a comma', () => {
    // The docs do not name these forms, so the matcher is wide. A brace group expands into one
    // pattern for each part, and `README.md` has no `/` (memory#path-specific-rules).
    expect(hit('docs/', 'a/docs/x.md')).toBe(true)
    expect(hit('docs/', 'docs/x.md')).toBe(true)
    expect(hit('/docs/', 'a/docs/x.md')).toBe(false)
    expect(hit('{README.md,src/*.ts}', 'docs/README.md')).toBe(true)
    expect(hit('src/{a,b}.ts', 'x/src/a.ts')).toBe(false)
    expect(hit('{src,lib}/*.ts', 'x/src/a.ts')).toBe(false)
    expect(hit('{src/a}.ts', 'x/{src/a}.ts')).toBe(false)
    expect(hit('src\\/a.ts', 'x/src/a.ts')).toBe(false)
    expect(hit('src\\/a.ts', 'src/a.ts')).toBe(true)
    // A `{` with no `}` is text, so the `/` after it anchors the glob.
    expect(hit('{a,b/c', 'x/{a,b/c')).toBe(false)
    expect(hit('{a,b/c', '{a,b/c')).toBe(true)
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
