// The plugin that holds a `plugin.json`, for a rule that lints the manifest
// and reads the files around it. `readPlugin` finds the plugin root once. A
// rule does not find a plugin root again (ADR 001, Decision 10).
import path from 'node:path'
import type { ValueNode } from './marketplace-json.ts'
import { realSource } from './marketplace-source.ts'
import { isPluginRoot } from './plugin-root.ts'
import { isInside, readManifest, realDirectory, repositoryRoot, UNREADABLE } from './skill-tree.ts'

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

/** The result of `locate` for a path that leaves the plugin root. */
export const ESCAPES: unique symbol = Symbol('escapes')

/** The real path that the manifest path `text` names, from the plugin root.
 *  The result is `ESCAPES` when the path leaves the plugin root, in its spelling
 *  or through a link. The result is undefined when the path is not there, or the
 *  rule cannot see it: a part of it is a dangling link, has a real path out of
 *  the repository, or fails to read. `text` is not checked for a `./` prefix.
 *  That is for the rules of the path format. */
export function locate(plugin: Plugin, text: string): string | typeof ESCAPES | undefined {
  const dir = path.resolve(plugin.root, text)
  if (!isInside(dir, plugin.root)) {
    return ESCAPES
  }
  const real = realSource(plugin.root, plugin.realRoot, plugin.bound, dir)
  if (typeof real !== 'string') {
    return undefined
  }
  return isInside(real, plugin.realRoot) ? real : ESCAPES
}

/** A string in the JSON of a manifest. */
export type StringNode = Extract<ValueNode, { type: 'String' }>

/** The strings of a manifest value that names paths: the value itself when it
 *  is a string, and each string of an array. Another value gives none, and so
 *  does an element that is not a string. */
export function pathNodes(value: ValueNode | undefined): StringNode[] {
  if (value?.type === 'String') {
    return [value]
  }
  if (value?.type !== 'Array') {
    return []
  }
  return value.elements.flatMap((element) =>
    element.value.type === 'String' ? [element.value] : [],
  )
}
