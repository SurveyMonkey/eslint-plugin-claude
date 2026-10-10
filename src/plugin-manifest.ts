// The plugin that holds a `plugin.json`, for a rule that lints the manifest
// and reads the files around it. `readPlugin` finds the plugin root once. A
// rule checks the plugin root in code (ADR 001, Decision 10).
import { Stats } from 'node:fs'
import path from 'node:path'
import type { ValueNode } from './marketplace-json.ts'
import { realSource } from './marketplace-source.ts'
import { isPluginRoot } from './plugin-root.ts'
import {
  isInside,
  readManifest,
  realDirectory,
  repositoryRoot,
  statOf,
  UNREADABLE,
} from './skill-tree.ts'

/** The plugin of a manifest. `root` is the plugin root as the linted path gives
 *  it, `realRoot` is its real path, and `bound` is the real path of the
 *  repository (ADR 001, Decision 14). `fields` are the keys of the manifest on
 *  disk. They are always an object: a manifest that is absent or not an object
 *  gives no plugin. */
export interface Plugin {
  readonly bound: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly realRoot: string
  readonly root: string
}

/** The plugin of the manifest at `file`, which is `.claude-plugin/plugin.json`.
 *  The result is undefined when the rule cannot see the plugin, so a rule makes
 *  no report. The rule cannot see it in these cases: the root is not a plugin
 *  root, or `isPluginRoot` cannot see it. The manifest can be out of the
 *  repository, or a link with no target. The real path of the root can be out
 *  of the repository. It can fail to parse to an object, or
 *  fail to read. */
export function readPlugin(file: string): Plugin | undefined {
  return readPluginAt(path.dirname(path.dirname(path.resolve(file))))
}

/** True when the plugin root of the manifest at `file` is `.claude/skills/<name>`.
 *  Claude Code loads such a plugin in place and never copies it. */
export function isSkillsPlugin(file: string): boolean {
  const skills = path.dirname(path.dirname(path.dirname(path.resolve(file))))
  return path.basename(skills) === 'skills' && path.basename(path.dirname(skills)) === '.claude'
}

/** The plugin of the manifest at `file` when its root is `.claude/skills/<name>`. */
export function skillsPlugin(file: string): Plugin | undefined {
  return isSkillsPlugin(file) ? readPlugin(file) : undefined
}

/** The plugin at the plugin root `root`, for a rule that lints a file of the
 *  plugin other than the manifest. The result is undefined in the cases of
 *  `readPlugin`. */
export function readPluginAt(root: string): Plugin | undefined {
  if (isPluginRoot(root) !== true) {
    return undefined
  }
  const bound = repositoryRoot(root)
  const fields = readManifest(root, bound)
  if (fields === UNREADABLE || fields === null) {
    return undefined
  }
  const realRoot = realDirectory(root)
  // A root that links out of the repository, with a `.claude-plugin` that links
  // back in, is a plugin that a rule must not look at (ADR 001, Decision 14).
  return isInside(realRoot, bound) ? { bound, fields, realRoot, root } : undefined
}

/** The result of `locate` for a path that leaves the plugin root. */
export const ESCAPES: unique symbol = Symbol('escapes')

/** The result of `lookup` for a path with nothing at it. */
export const MISSING: unique symbol = Symbol('missing')

/** The real path that the manifest path `text` names, from the plugin root.
 *  The result is `ESCAPES` when the path leaves the plugin root, in its spelling
 *  or through a link. The result is `MISSING` when the path is not there. The
 *  result is undefined when the rule cannot see the path. A part of the path
 *  can be a link with no target, can have a real path out of the repository, or
 *  can fail to read. `text` is not checked for a `./` prefix. That is for the
 *  rules of the path format. */
export function lookup(
  plugin: Plugin,
  text: string,
): string | typeof ESCAPES | typeof MISSING | undefined {
  const dir = path.resolve(plugin.root, text)
  if (!isInside(dir, plugin.root)) {
    return ESCAPES
  }
  const real = realSource(plugin.root, plugin.realRoot, plugin.bound, dir)
  if (typeof real !== 'string') {
    return real.kind === 'missing' ? MISSING : undefined
  }
  return isInside(real, plugin.realRoot) ? real : ESCAPES
}

/** The real path that the manifest path `text` names, from the plugin root.
 *  The result is `ESCAPES` when the path leaves the plugin root, in its spelling
 *  or through a link. The result is undefined when the path is not there. It is
 *  also undefined when the rule cannot see the path (see `lookup`). */
export function locate(plugin: Plugin, text: string): string | typeof ESCAPES | undefined {
  const found = lookup(plugin, text)
  return found === MISSING ? undefined : found
}

/** True when `file` below the plugin root is a file, false when it is not there
 *  or is another kind of entry, and undefined when the rule cannot see it. A
 *  part of the path can be a link with no target, or have a real path out of the
 *  repository. */
export function isPluginFile(plugin: Plugin, file: string): boolean | undefined {
  const real = realSource(plugin.root, plugin.realRoot, plugin.bound, path.join(plugin.root, file))
  if (typeof real !== 'string') {
    return real.kind === 'missing' ? false : undefined
  }
  const stat = statOf(real)
  return stat instanceof Stats && stat.isFile()
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
