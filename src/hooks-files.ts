// Find out if a `hooks.json` file is one that Claude Code reads. The globs of
// the rules are broad, so each rule asks here what the file is to Claude Code
// (ADR 001, Decision 10). A plugin reads `hooks/hooks.json` at its root. Project
// and user hooks go under the `hooks` key of a settings file, so there is no
// standalone hooks file for them (docs/rules/hooks-no-standalone-file.md).
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import { readManifest, repositoryRoot, UNREADABLE } from './skill-tree.ts'

/** What Claude Code does with a `hooks.json` file. A plugin file is one that it
 *  reads. The other two kinds are files that it does not read: a standalone file in
 *  `.claude/`, and a file in `.claude-plugin/` that the manifest does not name. */
export type HooksFileKind = 'plugin' | 'project' | 'manifestDir'

/** True when the `hooks` key of the plugin manifest names `file`. The key is a
 *  path, or an array of paths and inline objects. A path is relative to the
 *  plugin root. */
function manifestNames(hooks: unknown, root: string, file: string): boolean {
  const entries = Array.isArray(hooks) ? hooks : [hooks]
  return entries.some((entry) => typeof entry === 'string' && path.resolve(root, entry) === file)
}

/** What the file `filename` is to Claude Code, or null. The result is null in three
 *  cases. The file is no `hooks.json`. No part of the layout names the file. Or the check
 *  cannot see (ADR 001, Decision 14). A rule makes no report on a null result.
 *
 *  A file under `.claude-plugin/` is read only when the manifest names it. The file
 *  `.claude/hooks/hooks.json` is read only when `.claude/` is itself a plugin root.
 *  A plugin reads no `hooks.json` at the top of its root, so `.claude/hooks.json` is
 *  never read. Any other `hooks/hooks.json` is a plugin file, unless a hidden folder
 *  holds it. */
export function hooksFileKind(filename: string): HooksFileKind | null {
  const file = path.resolve(filename)
  if (path.basename(file) !== 'hooks.json') {
    return null
  }
  const dir = path.dirname(file)
  const inHooksDir = path.basename(dir) === 'hooks'
  // The directory that would be the plugin root if the file were the plugin file.
  const root = inHooksDir ? path.dirname(dir) : dir
  const holder = path.basename(root)
  if (holder === '.claude-plugin') {
    const plugin = path.dirname(root)
    const manifest = readManifest(plugin, repositoryRoot(plugin))
    if (manifest === UNREADABLE) {
      return null
    }
    return manifestNames(manifest?.hooks, plugin, file) ? 'plugin' : 'manifestDir'
  }
  if (holder === '.claude') {
    if (!inHooksDir) {
      return 'project'
    }
    const isRoot = isPluginRoot(root)
    return isRoot === UNREADABLE ? null : isRoot ? 'plugin' : 'project'
  }
  // Another hidden folder, such as `.github/hooks/`, holds the hooks of another tool.
  return inHooksDir && !holder.startsWith('.') ? 'plugin' : null
}
