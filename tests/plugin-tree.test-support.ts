// A plugin on disk, for a rule that reads the files around `plugin.json`.
// Each tree is a real directory in a temporary directory, with a `.git`
// directory at the top. `lintPlugin` runs one rule over the manifest of a
// plugin through `Linter`, because the case must build the file system around
// the lint.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import claude from '../src/index.ts'
import { tree } from './marketplace-tree.test-support.ts'

/** A plugin made by `pluginTree`: `dir` is the plugin root, `top` is the
 *  repository, and `code` is the text of the manifest. */
export interface PluginTree {
  code: string
  dir: string
  top: string
}

/** A plugin below `at` (a path with a trailing slash, or none for the
 *  repository root). `manifest` is the manifest, or its text. `files` are the
 *  other files of the plugin, keyed by their path from the plugin root. */
export function pluginTree(
  manifest: unknown,
  files: Record<string, string> = {},
  at = '',
): PluginTree {
  const code = typeof manifest === 'string' ? manifest : JSON.stringify(manifest)
  const top = tree({
    ...Object.fromEntries(Object.entries(files).map(([name, text]) => [at + name, text])),
    [`${at}.claude-plugin/plugin.json`]: code,
  })
  return { code, dir: path.join(top, at), top }
}

/** The messages of the rule `name` for the manifest `code` of the plugin
 *  `dir`. The rule `name` is the only rule that runs. */
export function lintPlugin(name: string, dir: string, code: string) {
  return new Linter({ cwd: path.parse(dir).root }).verify(
    code,
    [
      {
        files: ['**/.claude-plugin/plugin.json'],
        plugins: { json, claude },
        language: 'json/json',
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename: path.join(dir, '.claude-plugin', 'plugin.json') },
  )
}
