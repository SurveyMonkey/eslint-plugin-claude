// A RuleTester for each language, wired to vitest. RuleTester looks for
// global `describe` and `it`. This suite does not turn on vitest globals,
// so the tester gets them here. The file also holds helpers for a test that
// needs a path without access: `chmodCannotBlock` and `withoutAccess`.

import { accessSync, chmodSync, constants, statSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import { Linter, RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import plugin from '../src/index.ts'

Object.assign(RuleTester, { describe, it, itOnly: it.only })

export const markdownTester = new RuleTester({
  plugins: { markdown },
  language: 'markdown/gfm',
  languageOptions: { frontmatter: 'yaml' },
})

export const jsonTester = new RuleTester({
  plugins: { json },
  language: 'json/json',
})

export const json5Tester = new RuleTester({
  plugins: { json },
  language: 'json/json5',
})

/** The rule `name`, as the plugin registers it. */
export function ruleOf(name: string) {
  const rule = plugin.rules[name]
  if (rule === undefined) {
    throw new Error(`The plugin has no rule "${name}".`)
  }
  return rule
}

/** True where `chmod 000` does not stop a read: Windows, and a process that runs as root. */
export const chmodCannotBlock = process.platform === 'win32' || process.getuid?.() === 0

function canAccess(target: string): boolean {
  try {
    accessSync(
      target,
      statSync(target, { throwIfNoEntry: false })?.isDirectory() ? constants.X_OK : constants.R_OK,
    )
    return true
  } catch {
    return false
  }
}

/** Run `fn` while `target` has no access mode, then restore the mode, so that
 *  the temporary directory can be removed. */
export function withoutAccess<T>(target: string, fn: () => T): T {
  const mode = statSync(target).mode
  chmodSync(target, 0)
  try {
    // A test that expects no report would pass here without a real lock. Stop if the lock fails.
    if (canAccess(target)) {
      throw new Error(`chmod 000 does not block access to ${target}`)
    }
    return fn()
  } finally {
    chmodSync(target, mode)
  }
}

/** The messages of the rule `name` for `code` at `filename`. The tests use it
 *  where a case must change the file system around the lint. */
export function lintMarkdown(name: string, code: string, filename: string) {
  // The root of the file system is the base of the globs, so that an absolute path matches.
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, claude: plugin },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename },
  )
}

/** The messages of the rule `name` for the JSON text `code` at `filename`. The
 *  tests use it where a case needs the files glob of the plugin or a path
 *  that RuleTester does not take, and in `it.fails`, where the rule may be
 *  missing. */
export function lintJson(name: string, code: string, filename: string) {
  const absolute = path.resolve(filename)
  return new Linter({ cwd: path.parse(absolute).root }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json',
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename: absolute },
  )
}
