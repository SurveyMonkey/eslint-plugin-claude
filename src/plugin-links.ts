// Where a link leads, for a rule that compares a path with a plugin and with
// its marketplace. `placeOf` is the one check of the component paths of an
// entry in `marketplace.json` and of the links under a plugin. `escapingLinks`
// lists the links under a plugin that leave it. Every walk stops at the
// repository root. A link out of the repository, a link with no target and a
// folder that fails to list give no result (ADR 001, Decision 14).
import path from 'node:path'
import { realSource } from './marketplace-source.ts'
import type { Plugin } from './plugin-manifest.ts'
import { entriesOf, isInside, readJson, SKIPPED, UNREADABLE } from './skill-tree.ts'

/** The places that a path can lead to, as real paths. A plugin is inside its
 *  marketplace. A marketplace with no `marketplace.json` at or above the
 *  plugin root is the plugin itself. */
export interface Scopes {
  readonly marketplace: string
  readonly plugin: string
}

/** What `placeOf` finds at a path.
 *
 *  - `plugin`: the real path is in the plugin.
 *  - `marketplace`: the real path is out of the plugin and in the marketplace.
 *  - `outside`: the real path is out of the marketplace and in the repository.
 *  - `missing`: nothing is at the path.
 *  - `unreadable`: the rule cannot see the path. A part of it is a link with
 *    no target. Or a part has a real path out of the repository. Or a part
 *    fails to read.
 *
 *  `real` is the real path. A rule makes no report that rests on `unreadable`. */
export type Place =
  | { readonly reach: 'missing' | 'unreadable' }
  | { readonly reach: 'plugin' | 'marketplace' | 'outside'; readonly real: string }

/** The place of `target`, which is `root` or a path below it. `realRoot` is
 *  the real path of `root`, and `bound` is the real path of the repository. The
 *  walk down from `root` is `realSource`. */
export function placeOf(
  root: string,
  realRoot: string,
  bound: string,
  scopes: Scopes,
  target: string,
): Place {
  const real = realSource(root, realRoot, bound, target)
  if (typeof real !== 'string') {
    return { reach: real.kind === 'missing' ? 'missing' : 'unreadable' }
  }
  if (isInside(real, scopes.plugin)) {
    return { reach: 'plugin', real }
  }
  return { reach: isInside(real, scopes.marketplace) ? 'marketplace' : 'outside', real }
}

/** The real path of the marketplace root of `plugin`: the folder that holds
 *  the nearest `.claude-plugin/marketplace.json`, from the plugin root up to
 *  the repository root. The plugin root is the result when no folder holds one.
 *  The result is undefined when a candidate cannot be read. The file can be a
 *  link with no target, or a link out of the repository. It can also fail to
 *  read. A file that does not parse still marks its folder, because the rule
 *  needs only the place. The catalog need not list the plugin. */
export function marketplaceRootOf(plugin: Plugin): string | undefined {
  for (let at = plugin.realRoot; ; at = path.dirname(at)) {
    const found = readJson(path.join(at, '.claude-plugin', 'marketplace.json'), plugin.bound)
    if (found === UNREADABLE) {
      return undefined
    }
    if (found !== null) {
      return at
    }
    // The real path of the plugin is in the repository, so the climb reaches the root.
    if (at === plugin.bound) {
      return plugin.realRoot
    }
  }
}

/** A link under a plugin that leaves it. `file` is the path of the link from
 *  the plugin root. `target` is the real path of the target from the
 *  repository root, and `.` for the repository root. Both use slashes. `reach`
 *  is `marketplace` for a target in the marketplace, and `outside` for a target
 *  out of it. */
export interface Link {
  readonly file: string
  readonly reach: 'marketplace' | 'outside'
  readonly target: string
}

/** The path `to` from `from`, with slashes. */
const shown = (from: string, to: string) => path.relative(from, to).split(path.sep).join('/')

/** The links under `plugin` that lead out of it, depth first in name order. The walk
 *  skips `.git` and `node_modules`, and does not enter a link to a folder.
 *  A folder that fails to list is skipped. The result is empty when the
 *  marketplace root cannot be read. */
export function escapingLinks(plugin: Plugin): Link[] {
  const marketplace = marketplaceRootOf(plugin)
  const links: Link[] = []
  if (marketplace !== undefined) {
    const scopes = { marketplace, plugin: plugin.realRoot }
    collect(plugin, scopes, plugin.realRoot, links)
  }
  return links
}

function collect(plugin: Plugin, scopes: Scopes, dir: string, links: Link[]): void {
  const entries = entriesOf(dir)
  if (!Array.isArray(entries)) {
    return
  }
  const sorted = entries
    .filter((entry) => !SKIPPED.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const entry of sorted) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) {
      const place = placeOf(plugin.realRoot, plugin.realRoot, plugin.bound, scopes, full)
      if (place.reach === 'marketplace' || place.reach === 'outside') {
        const target = shown(plugin.bound, place.real) || '.'
        links.push({ file: shown(plugin.realRoot, full), reach: place.reach, target })
      }
    } else if (entry.isDirectory()) {
      collect(plugin, scopes, full, links)
    }
  }
}
