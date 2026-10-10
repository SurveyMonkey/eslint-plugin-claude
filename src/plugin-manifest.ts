// The plugin that holds a `plugin.json`, for a rule that lints the manifest
// and reads the files around it. `readPlugin` finds the plugin root once. A
// rule does not find a plugin root again (ADR 001, Decision 10).
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import { readManifest, realDirectory, repositoryRoot, UNREADABLE } from './skill-tree.ts'

/** The plugin of a manifest. `root` is the plugin root as the linted path gives
 *  it, `realRoot` is its real path, and `bound` is the real path of the
 *  repository (ADR 001, Decision 14). */
export interface Plugin {
  readonly bound: string
  readonly realRoot: string
  readonly root: string
}

/** The plugin of the manifest at `file`, which is `.claude-plugin/plugin.json`.
 *  The result is undefined when the rule cannot see the plugin, so a rule makes
 *  no report. The rule cannot see it in these cases: the root is not a plugin
 *  root, or `isPluginRoot` cannot see it. The manifest is out of the repository,
 *  is a dangling link, does not parse to an object, or fails to read. */
export function readPlugin(file: string): Plugin | undefined {
  const root = path.dirname(path.dirname(path.resolve(file)))
  if (isPluginRoot(root) !== true) {
    return undefined
  }
  const bound = repositoryRoot(root)
  const manifest = readManifest(root, bound)
  if (manifest === UNREADABLE || manifest === null) {
    return undefined
  }
  return { bound, realRoot: realDirectory(root), root }
}
