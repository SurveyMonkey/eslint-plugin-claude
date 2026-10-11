// The files of an eval suite: which Markdown file is a prompt, a grader or a mock, and which
// directories are cases. The layout is the tree in the "Eval suite reference" section of the plugin
// evals page. The trees are on disk, because the check finds the plugin around the file.
import { chmodSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { caseDirectories, evalFileOf } from '../src/plugin-evals.ts'
import { link, noLinks, tree } from './marketplace-tree.test-support.ts'
import { chmodCannotBlock } from './rule-tester.test-support.ts'

const MANIFEST = '.claude-plugin/plugin.json'
const PLUGIN = JSON.stringify({ name: 'p' })
const linked = noLinks ? it.skip : it

/** The kind, case folder and server of the eval file `file` in the tree `files`, or null. The
 *  folders are relative to the top of the tree. */
function seen(files: Record<string, string>, file: string, at = '') {
  const top = tree({ [`${at}${MANIFEST}`]: PLUGIN, ...files })
  const found = evalFileOf(path.join(top, file))
  if (found === null) {
    return null
  }
  const rel = (dir: string | null) => (dir === null ? null : path.relative(top, dir))
  return {
    kind: found.kind,
    evalDir: rel(found.evalDir),
    caseDir: rel(found.caseDir),
    ...(found.server === undefined ? {} : { server: found.server }),
  }
}

describe('evalFileOf', () => {
  it('reads a prompt.md in a case of the default eval directory', () => {
    expect(seen({ 'evals/first/prompt.md': 'x' }, 'evals/first/prompt.md')).toEqual({
      kind: 'prompt',
      evalDir: 'evals',
      caseDir: 'evals/first',
    })
  })

  it('reads a case that a group directory holds, and a plugin below the top', () => {
    const files = { 'plugins/p/evals/group/first/prompt.md': 'x' }
    expect(seen(files, 'plugins/p/evals/group/first/prompt.md', 'plugins/p/')).toEqual({
      kind: 'prompt',
      evalDir: 'plugins/p/evals',
      caseDir: 'plugins/p/evals/group/first',
    })
  })

  it('reads the eval directory of experimental.evals, and no other', () => {
    const manifest = { [MANIFEST]: JSON.stringify({ name: 'p', experimental: { evals: 'qa/e' } }) }
    const files = { ...manifest, 'qa/e/c/prompt.md': 'x', 'evals/c/prompt.md': 'x' }
    expect(seen(files, 'qa/e/c/prompt.md')).toMatchObject({ kind: 'prompt', evalDir: 'qa/e' })
    expect(seen(files, 'evals/c/prompt.md')).toBeNull()
  })

  it('reads the default directory when experimental.evals is unusable', () => {
    for (const evals of ['../x', 5, '/abs']) {
      const files = {
        [MANIFEST]: JSON.stringify({ name: 'p', experimental: { evals } }),
        'evals/c/prompt.md': 'x',
      }
      expect(seen(files, 'evals/c/prompt.md'), String(evals)).toMatchObject({ kind: 'prompt' })
    }
  })

  it('reads a prompt.md that sits at the top of the eval directory', () => {
    expect(seen({ 'evals/prompt.md': 'x' }, 'evals/prompt.md')).toMatchObject({
      kind: 'prompt',
      caseDir: 'evals',
    })
  })

  it('does not read a prompt.md outside the eval directory', () => {
    expect(seen({ 'prompt.md': 'x' }, 'prompt.md')).toBeNull()
    expect(seen({ 'docs/c/prompt.md': 'x' }, 'docs/c/prompt.md')).toBeNull()
    expect(seen({ 'evals2/c/prompt.md': 'x' }, 'evals2/c/prompt.md')).toBeNull()
  })

  it('does not read a prompt.md that belongs to a case, or the folders mocks and results', () => {
    const files = { 'evals/c/prompt.md': 'x', 'evals/c/fixtures/prompt.md': 'x' }
    expect(seen(files, 'evals/c/fixtures/prompt.md')).toBeNull()
    const yaml = { 'evals/c/case.yaml': 'x', 'evals/c/deep/er/prompt.md': 'x' }
    expect(seen(yaml, 'evals/c/deep/er/prompt.md')).toBeNull()
    expect(seen({ 'evals/mocks/prompt.md': 'x' }, 'evals/mocks/prompt.md')).toBeNull()
    expect(seen({ 'evals/results/prompt.md': 'x' }, 'evals/results/prompt.md')).toBeNull()
    expect(seen({ 'evals/results/t/prompt.md': 'x' }, 'evals/results/t/prompt.md')).toBeNull()
    // A case that is named results, below a group, is a case.
    expect(seen({ 'evals/g/results/prompt.md': 'x' }, 'evals/g/results/prompt.md')).toMatchObject({
      kind: 'prompt',
    })
  })

  it('reads a grader of a case that holds a prompt.md or a case.yaml', () => {
    for (const marker of ['evals/c/prompt.md', 'evals/c/case.yaml']) {
      expect(seen({ [marker]: 'x', 'evals/c/graders/g.md': 'x' }, 'evals/c/graders/g.md')).toEqual({
        kind: 'grader',
        evalDir: 'evals',
        caseDir: 'evals/c',
      })
    }
  })

  it('does not read a grader without a case, in a nested folder, or outside the eval directory', () => {
    expect(seen({ 'evals/c/graders/g.md': 'x' }, 'evals/c/graders/g.md')).toBeNull()
    expect(seen({ 'evals/graders/g.md': 'x' }, 'evals/graders/g.md')).toBeNull()
    const nested = { 'evals/c/prompt.md': 'x', 'evals/c/graders/sub/g.md': 'x' }
    expect(seen(nested, 'evals/c/graders/sub/g.md')).toBeNull()
    const out = { 'x/c/prompt.md': 'x', 'x/c/graders/g.md': 'x' }
    expect(seen(out, 'x/c/graders/g.md')).toBeNull()
    expect(
      seen({ 'evals/c/prompt.md': 'x', 'evals/c/graders/g.txt': 'x' }, 'evals/c/graders/g.txt'),
    ).toBeNull()
  })

  it('reads a grader that is named prompt.md as a grader', () => {
    expect(
      seen(
        { 'evals/c/prompt.md': 'x', 'evals/c/graders/prompt.md': 'x' },
        'evals/c/graders/prompt.md',
      ),
    ).toMatchObject({ kind: 'grader' })
  })

  it('reads a mock of the suite and a mock of a case, with the server', () => {
    expect(seen({ 'evals/mocks/gh/issue.md': 'x' }, 'evals/mocks/gh/issue.md')).toEqual({
      kind: 'mock',
      evalDir: 'evals',
      caseDir: null,
      server: 'gh',
    })
    expect(seen({ 'evals/mocks/gh/_server.md': 'x' }, 'evals/mocks/gh/_server.md')).toMatchObject({
      kind: 'mock',
    })
    const files = { 'evals/c/prompt.md': 'x', 'evals/c/mocks/gh/issue.md': 'x' }
    expect(seen(files, 'evals/c/mocks/gh/issue.md')).toEqual({
      kind: 'mock',
      evalDir: 'evals',
      caseDir: 'evals/c',
      server: 'gh',
    })
  })

  it('does not read saved answers, fixtures, a mock without a case, or a mock outside the suite', () => {
    const none = (file: string, files: Record<string, string> = {}) =>
      expect(seen({ [file]: 'x', ...files }, file), file).toBeNull()
    none('evals/mocks/.replay/gh/answer.md')
    none('evals/mocks/.replay/answer.md')
    none('evals/mocks/gh/fixtures/f.md')
    none('evals/mocks/answer.md')
    none('evals/c/mocks/gh/issue.md')
    none('evals/c/mocks/gh/issue.txt', { 'evals/c/prompt.md': 'x' })
    none('mocks/gh/issue.md')
    none('evals/other/mocks/gh/issue.md', { 'evals/c/prompt.md': 'x' })
  })

  it('does not read a file when the plugin is not seen', () => {
    const file = 'evals/c/prompt.md'
    const top = tree({ [file]: 'x' })
    expect(evalFileOf(path.join(top, file))).toBeNull()
    const broken = tree({ [file]: 'x', [MANIFEST]: '{' })
    expect(evalFileOf(path.join(broken, file))).toBeNull()
    const array = tree({ [file]: 'x', [MANIFEST]: '[]' })
    expect(evalFileOf(path.join(array, file))).toBeNull()
  })

  it('does not read a file when the eval directory is not there', () => {
    const top = tree({ [MANIFEST]: PLUGIN })
    expect(evalFileOf(path.join(top, 'evals/c/prompt.md'))).toBeNull()
  })

  it('stops at the repository root, and reads no plugin above it', () => {
    const outer = tree({ [MANIFEST]: PLUGIN, 'repo/evals/c/prompt.md': 'x', 'repo/.git/HEAD': 'x' })
    expect(evalFileOf(path.join(outer, 'repo/evals/c/prompt.md'))).toBeNull()
    // Without a `.git` the walk checks the folder of the file only.
    const bare = tree({ [MANIFEST]: PLUGIN, 'evals/c/prompt.md': 'x' }, false)
    expect(evalFileOf(path.join(bare, 'evals/c/prompt.md'))).toBeNull()
  })

  it('reads the nearest plugin', () => {
    const files = {
      'inner/.claude-plugin/plugin.json': PLUGIN,
      'inner/evals/c/prompt.md': 'x',
      'evals/inner/evals/c/prompt.md': 'x',
    }
    expect(seen(files, 'inner/evals/c/prompt.md')).toMatchObject({ evalDir: 'inner/evals' })
  })

  linked('does not read a plugin whose root links out of the repository', () => {
    const outside = tree({ 'p/evals/c/prompt.md': 'x', 'p/.claude-plugin/plugin.json': PLUGIN })
    const top = tree({})
    link(top, 'plug', path.join(outside, 'p'))
    expect(evalFileOf(path.join(top, 'plug/evals/c/prompt.md'))).toBeNull()
  })

  linked('does not read an eval directory that links out of the repository', () => {
    const outside = tree({ 'e/c/prompt.md': 'x' })
    const top = tree({ [MANIFEST]: PLUGIN })
    link(top, 'evals', path.join(outside, 'e'))
    expect(evalFileOf(path.join(top, 'evals/c/prompt.md'))).toBeNull()
  })

  linked('reads an eval directory that links to a place in the repository', () => {
    const top = tree({ [MANIFEST]: PLUGIN, 'real/c/prompt.md': 'x' })
    link(top, 'evals', 'real')
    expect(evalFileOf(path.join(top, 'evals/c/prompt.md'))).toMatchObject({ kind: 'prompt' })
  })

  linked('counts a link to a file as a prompt.md or a case.yaml of a case', () => {
    const top = tree({ [MANIFEST]: PLUGIN, 'evals/c/graders/g.md': 'x', 'src/p.md': 'x' })
    link(top, 'evals/c/prompt.md', '../../src/p.md')
    expect(evalFileOf(path.join(top, 'evals/c/graders/g.md'))).toMatchObject({ kind: 'grader' })
  })
})

/** Run `fn` while the directory `dir` can be entered but not listed. */
function unlisted<T>(dir: string, fn: () => T): T {
  const mode = statSync(dir).mode
  chmodSync(dir, 0o311)
  try {
    return fn()
  } finally {
    chmodSync(dir, mode)
  }
}

describe('evalFileOf with a case that cannot be listed', () => {
  const blind = chmodCannotBlock ? it.skip : it

  blind('reads no grader of a case that it cannot list', () => {
    const top = tree({ [MANIFEST]: PLUGIN, 'evals/c/prompt.md': 'x', 'evals/c/graders/g.md': 'x' })
    const file = path.join(top, 'evals/c/graders/g.md')
    expect(evalFileOf(file)).toMatchObject({ kind: 'grader' })
    expect(unlisted(path.join(top, 'evals/c'), () => evalFileOf(file))).toBeNull()
  })

  blind('reads no prompt.md below a folder that it cannot list', () => {
    const top = tree({ [MANIFEST]: PLUGIN, 'evals/g/c/prompt.md': 'x' })
    const file = path.join(top, 'evals/g/c/prompt.md')
    expect(evalFileOf(file)).toMatchObject({ kind: 'prompt' })
    expect(unlisted(path.join(top, 'evals/g'), () => evalFileOf(file))).toBeNull()
  })
})

describe('evalFileOf with a plugin that it cannot see', () => {
  const linkedIt = noLinks ? it.skip : it

  linkedIt('does not read the plugin above a plugin root that it cannot see', () => {
    const file = 'evals/group/inner/evals/c/prompt.md'
    const top = tree({ [MANIFEST]: PLUGIN, [file]: 'x' })
    expect(evalFileOf(path.join(top, file))).toMatchObject({ kind: 'prompt' })
    // The folder has no `.git`, so it is out of the repository of `top`.
    const outside = tree({ 'plugin.json': PLUGIN }, false)
    link(top, 'evals/group/inner/.claude-plugin', outside)
    expect(evalFileOf(path.join(top, file))).toBeNull()
  })
})

describe('caseDirectories', () => {
  const cases = (files: Record<string, string>) => {
    const top = tree({ [MANIFEST]: PLUGIN, ...files })
    return caseDirectories(path.join(top, 'evals')).map((dir) => path.relative(top, dir))
  }

  it('lists the directories that hold a prompt.md or a case.yaml, in name order', () => {
    expect(
      cases({
        'evals/a/prompt.md': 'x',
        'evals/b/case.yaml': 'x',
        'evals/g/c/prompt.md': 'x',
        'evals/g/d/case.yaml': 'x',
        'evals/notes/readme.md': 'x',
      }),
    ).toEqual(['evals/a', 'evals/b', 'evals/g/c', 'evals/g/d'])
  })

  it('does not enter a case, and counts the eval directory when it is a case', () => {
    expect(cases({ 'evals/a/prompt.md': 'x', 'evals/a/sub/prompt.md': 'x' })).toEqual(['evals/a'])
    expect(cases({ 'evals/prompt.md': 'x', 'evals/a/prompt.md': 'x' })).toEqual(['evals'])
  })

  it('skips mocks and results at the top, .git and node_modules, and keeps a deeper results', () => {
    expect(
      cases({
        'evals/mocks/x/prompt.md': 'x',
        'evals/results/t/prompt.md': 'x',
        'evals/g/.git/prompt.md': 'x',
        'evals/g/node_modules/prompt.md': 'x',
        'evals/g/results/prompt.md': 'x',
      }),
    ).toEqual(['evals/g/results'])
  })

  it('lists nothing for a directory that is not there', () => {
    const top = tree({})
    expect(caseDirectories(path.join(top, 'evals'))).toEqual([])
  })

  linked('does not enter a link to a directory', () => {
    const top = tree({ [MANIFEST]: PLUGIN, 'real/c/prompt.md': 'x', 'evals/a/prompt.md': 'x' })
    link(top, 'evals/g', '../real')
    expect(caseDirectories(path.join(top, 'evals')).map((d) => path.relative(top, d))).toEqual([
      'evals/a',
    ])
  })
})
