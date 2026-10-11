// An eval suite on disk, for a rule that lints a Markdown file of the suite. The rule finds the
// plugin and the case around the file, so each tree is a real repository with a manifest.
import path from 'node:path'
import { tree } from './marketplace-tree.test-support.ts'
import { lintMarkdown } from './rule-tester.test-support.ts'

/** The manifest of a plugin with no `experimental.evals`. */
export const MANIFEST = '.claude-plugin/plugin.json'
export const PLUGIN = JSON.stringify({ name: 'p' })

/** A repository with the plugin manifest and the files `files`, keyed by their path. The result is
 *  the top directory. */
export const suite = (files: Record<string, string> = {}) => tree({ [MANIFEST]: PLUGIN, ...files })

/** The messages of the rule `name` for the Markdown text `code` of the file `file` below `top`. */
export const lintEval = (name: string, top: string, file: string, code: string) =>
  lintMarkdown(name, code, path.join(top, file))
