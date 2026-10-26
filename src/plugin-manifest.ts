// The plugin that holds a `plugin.json`, for a rule that lints the manifest
// and reads the files around it. `readPlugin` finds the plugin root once. A
// rule checks the plugin root in code (ADR 001, Decision 10).
// `readListedPluginAt` also reads a listed plugin with no `plugin.json`.
import { Stats } from 'node:fs'
import path from 'node:path'
import type { ValueNode } from './marketplace-json.ts'
import { realSource } from './marketplace-source.ts'
import { hasManifest, isPluginRoot } from './plugin-root.ts'
import {
  entriesOf,
  isInside,
  readManifest,
  realDirectory,
  realOf,
  repositoryRoot,
  statOf,
  UNREADABLE,
} from './skill-tree.ts'

/** The plugin of a manifest. `root` is the plugin root as the linted path gives
 *  it, `realRoot` is its real path, and `bound` is the real path of the
 *  repository (ADR 001, Decision 14). `fields` are the keys of the manifest on
 *  disk. They are always an object: a manifest that is not an object gives no
 *  plugin. An absent manifest gives no plugin, except in `readListedPluginAt`.
 *  There, the `fields` are empty. */
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
 *  `readPlugin`. A root that a `marketplace.json` lists, with no `plugin.json`,
 *  also gives no plugin. */
export function readPluginAt(root: string): Plugin | undefined {
  return pluginAt(root, false)
}

/** The plugin at the plugin root `root`, as `readPluginAt` gives it. A plugin
 *  root that a `marketplace.json` lists, with no `plugin.json`, also gives a
 *  plugin. With no `plugin.json`, the entry is the manifest (ADR 001, Decision
 *  10). This function does not read the entry, so the `fields` are empty. Such
 *  a root whose entry has a key that replaces a default location gives no
 *  plugin, because `isPluginRoot` gives `UNREADABLE` for it. */
export function readListedPluginAt(root: string): Plugin | undefined {
  return pluginAt(root, true)
}

/** The plugin at `root`. With `listed`, a plugin root with no `plugin.json`
 *  gives a plugin with empty `fields`. */
function pluginAt(root: string, listed: boolean): Plugin | undefined {
  if (isPluginRoot(root) !== true) {
    return undefined
  }
  const bound = repositoryRoot(root)
  // `readManifest` gives null only when no `plugin.json` is there.
  const read = readManifest(root, bound)
  const fields = read === null && listed ? {} : read
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

/** A skill that a path of the manifest `skills` key gives. `file` is its `SKILL.md`, spelled
 *  from the plugin root and the path text. `folder` is the name of its folder. */
export interface ListedSkill {
  readonly file: string
  readonly folder: string
}

/** The `SKILL.md` at `file` when its real path is in the plugin. The result is null when no
 *  `SKILL.md` is there, and undefined when it leads out of the plugin or the rule cannot see it. */
function skillAt(plugin: Plugin, file: string, folder: string): ListedSkill | null | undefined {
  const real = realOf(file)
  if (real === null) {
    return null
  }
  return typeof real === 'string' && isInside(real, plugin.realRoot) ? { file, folder } : undefined
}

/** The skills that the paths of the manifest `skills` key of `plugin` give. The key takes a
 *  path or a list of paths. A path names one skill folder that holds a `SKILL.md`, or a folder
 *  of skill folders (manifest reference, Fields table). The result has no skill for a path that
 *  names the plugin root, that is not there, that leaves the plugin, or that the rule cannot
 *  see. It also has none for a `SKILL.md` that the rule cannot see, or that leads out of the
 *  plugin. The paths add to `skills/`, and a path can name `skills/`, so a skill can occur two
 *  times. */
export function listedSkills(plugin: Plugin): ListedSkill[] {
  const { skills } = plugin.fields
  const texts = (Array.isArray(skills) ? skills : [skills]).filter(
    (item): item is string => typeof item === 'string',
  )
  return texts.flatMap((text) => {
    const real = lookup(plugin, text)
    if (typeof real !== 'string' || real === plugin.realRoot) {
      return []
    }
    const dir = path.resolve(plugin.root, text)
    // A folder with a `SKILL.md` is one skill, also when the rule cannot see the file.
    const own = skillAt(plugin, path.join(dir, 'SKILL.md'), path.basename(dir))
    if (own !== null) {
      return own === undefined ? [] : [own]
    }
    const entries = entriesOf(real)
    return (Array.isArray(entries) ? entries : [])
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .flatMap((name) => skillAt(plugin, path.join(dir, name, 'SKILL.md'), name) ?? [])
  })
}

/** The plugin whose manifest `skills` key lists the skill at `file`, a `SKILL.md`, and the
 *  skill. The walk starts at the directory above the skill folder, because a plugin root that is
 *  the skill folder lists no path for it. The walk stops at the first plugin root that lists the
 *  skill, at a root that it cannot see, and at the repository root. The result is undefined when
 *  no plugin lists the skill. */
export function listingPlugin(file: string): { plugin: Plugin; skill: ListedSkill } | undefined {
  const folder = path.dirname(path.resolve(file))
  const self = realOf(file)
  // `repositoryRoot` gives the real path of a directory at or above `folder`, so the walk meets it.
  // A skill folder that is the repository root has no plugin root in the repository.
  const bound = repositoryRoot(folder)
  if (realDirectory(folder) === bound) {
    return undefined
  }
  for (let at = path.dirname(folder); ; at = path.dirname(at)) {
    const manifest = hasManifest(at)
    if (manifest === UNREADABLE) {
      return undefined
    }
    const plugin = manifest ? readPluginAt(at) : undefined
    const skill = plugin && listedSkills(plugin).find((item) => realOf(item.file) === self)
    if (plugin !== undefined && skill !== undefined) {
      return { plugin, skill }
    }
    if (realDirectory(at) === bound) {
      return undefined
    }
  }
}
