// A marketplace on disk, for a rule that reads the `plugin.json` of an entry
// source. Each tree is a real directory in a temporary directory, with or
// without a `.git` directory. `lintMarketplace` runs one rule over the
// marketplace file of a tree through `Linter`, because the case must build
// the file system around the lint.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { afterAll } from 'vitest'
import plugin from '../src/index.ts'

// The real path, so that a bound compares equal where the temporary directory is a link (macOS).
const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'marketplace-tree-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** True where a test cannot make a symbolic link. */
export const noLinks = process.platform === 'win32'

let count = 0
/** A fresh directory with the files `files`, each keyed by its path. `git` is
 *  true for a `.git` directory at the top. The result is the top directory. */
export function tree(files: Record<string, string>, git = true) {
  const root = path.join(scratch, `tree${count++}`)
  mkdirSync(root, { recursive: true })
  if (git) {
    mkdirSync(path.join(root, '.git'))
  }
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

/** A link at `at` to `target`, both relative to `root`. The target is written as given. */
export function link(root: string, at: string, target: string) {
  mkdirSync(path.dirname(path.join(root, at)), { recursive: true })
  symlinkSync(target, path.join(root, at))
}

/** The text of a `plugin.json` that sets the fields `fields`. */
export const manifestOf = (fields: Record<string, unknown>) => JSON.stringify(fields)

/** The text of a `marketplace.json` with the entries `plugins`, and the
 *  members `extra` at the top level. */
export const marketplaceOf = (plugins: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'acme', owner: { name: 'o' }, plugins, ...extra })

/** The file `.claude-plugin/marketplace.json` below `dir`. */
export const marketplaceFile = (dir: string) => path.join(dir, '.claude-plugin', 'marketplace.json')

/** The messages of the rule `name` for the marketplace `code` that sits in
 *  `dir`. The rule `name` is the only rule that runs. */
export function lintMarketplace(name: string, dir: string, code: string) {
  return new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude-plugin/marketplace.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename: marketplaceFile(dir) },
  )
}

/** The messages of the rule `name` for the settings file `file` (such as
 *  `.claude/settings.json`) with the text `code`, in the tree `dir`. The rule
 *  `name` is the only rule that runs. */
export function lintSettings(name: string, dir: string, file: string, code: string) {
  return new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude/settings.json', '**/.claude/settings.local.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename: path.join(dir, file) },
  )
}
