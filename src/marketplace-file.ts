// The reader of a `marketplace.json` that a project settings file points at.
// An `extraKnownMarketplaces` entry with a `file` or `directory` source names
// a local marketplace. A rule that compares a settings key with that
// marketplace asks here. The docs say that a relative path "resolves against
// your repository's main checkout" (plugins/org, "Require a marketplace and
// its plugins"). The reader resolves a relative `path` from the root of the
// checkout that holds the settings file. The two differ in a git worktree.
// With no `.git`, the reader resolves from the directory that holds
// `.claude/`. That is a choice of this rule, and the docs do not say it. The
// reader reads the file through `readJson`. The bound is the repository
// root. With no `.git`, it is the real path of `.claude/` (ADR 001, Decision
// 14).
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  readJson,
  realDirectory,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** What a rule sees at a local marketplace source. A rule makes no report
 *  except for `marketplace`.
 *
 *  - `not-local`: the source is not a `file` or `directory` source with a
 *    relative `path`. This covers every other source type, and a `path` that
 *    is absolute, empty or not a string. A rule also gets it when no settings
 *    file declares the marketplace, or the file of higher precedence is not
 *    readable (`declaredSource`).
 *  - `missing`: no `marketplace.json` is at the path, and the path is in the
 *    bound.
 *  - `unreadable`: the rule cannot see the file. A link of the path is
 *    dangling, the real path is out of the bound, or the read fails. The file
 *    is not there and its path is out of the bound. The file does not parse
 *    to an object, or is no file.
 *  - `marketplace`: the file. `name` is its `name`, and is undefined when that
 *    is not a string. `entries` holds the `name` of each entry of `plugins`
 *    that has a string `name`. It is undefined when `plugins` is not an
 *    array. */
export type MarketplaceRead =
  | { readonly kind: 'not-local' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreadable' }
  | {
      readonly kind: 'marketplace'
      readonly name: string | undefined
      readonly entries: readonly string[] | undefined
    }

/** The results of `MarketplaceRead` that stop the read. */
type Stop = Exclude<MarketplaceRead, { readonly kind: 'marketplace' }>

const NOT_LOCAL: Stop = { kind: 'not-local' }
const MISSING: Stop = { kind: 'missing' }
const CANNOT_SEE: Stop = { kind: 'unreadable' }

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The directory that holds the `.claude/` directory of the settings file `file`. */
const projectOf = (file: string) => path.dirname(path.dirname(path.resolve(file)))

/** The bound of each read for the settings file `file`: its repository root.
 *  With no `.git`, it is the real path of the `.claude/` directory (ADR 001,
 *  Decision 14). The search starts at the directory that holds `.claude/`. So
 *  with a `.git`, a `.claude` link cannot move the bound. With no `.git`, the
 *  bound is the real path of `.claude/`. */
function boundOf(file: string): string {
  const root = repositoryRoot(projectOf(file))
  return existsSync(path.join(root, '.git'))
    ? root
    : realDirectory(path.dirname(path.resolve(file)))
}

/** True when `text` is an absolute path on any platform. The Windows form
 *  covers a path that starts with `/` too. */
export const absolute = (text: string) => path.win32.isAbsolute(text)

/** What the reader finds at a local marketplace source: a result that stops the
 *  read, or the parsed object of the file. */
type Located = Stop | { readonly kind: 'data'; readonly data: Record<string, unknown> }

/** Find and parse the `marketplace.json` that `source` points at. `source` is
 *  the `source` value of an `extraKnownMarketplaces` entry in the settings file
 *  `settingsFile`, as `JSON.parse` gives it. A `file` source names the
 *  `marketplace.json` itself. A `directory` source names the marketplace
 *  root, the directory that holds `.claude-plugin/marketplace.json`
 *  (marketplace reference, "Fields by type"). */
function locate(settingsFile: string, source: unknown): Located {
  if (!isObject(source)) {
    return NOT_LOCAL
  }
  const { source: type, path: given } = source
  if (
    (type !== 'file' && type !== 'directory') ||
    typeof given !== 'string' ||
    given === '' ||
    absolute(given)
  ) {
    return NOT_LOCAL
  }
  const bound = boundOf(settingsFile)
  const target = path.resolve(repositoryRoot(projectOf(settingsFile)), given)
  const parsed = readJson(
    type === 'file' ? target : path.join(target, '.claude-plugin', 'marketplace.json'),
    bound,
  )
  if (parsed === null) {
    return MISSING
  }
  if (parsed === UNREADABLE || !isObject(parsed.data)) {
    return CANNOT_SEE
  }
  return { kind: 'data', data: parsed.data }
}

/** Read the `marketplace.json` that `source` points at (see `locate`). */
export function readMarketplaceFile(settingsFile: string, source: unknown): MarketplaceRead {
  const found = locate(settingsFile, source)
  if (found.kind !== 'data') {
    return found
  }
  const { name, plugins } = found.data
  return {
    kind: 'marketplace',
    name: typeof name === 'string' ? name : undefined,
    entries: Array.isArray(plugins)
      ? plugins.flatMap((entry: unknown) =>
          isObject(entry) && typeof entry.name === 'string' ? [entry.name] : [],
        )
      : undefined,
  }
}

/** The `source` value of each entry of `plugins` in the `marketplace.json` that
 *  `source` points at, by entry `name`. A name that two entries share has both
 *  values, in file order. The result is undefined when the reader cannot see a
 *  marketplace there, as in `readMarketplaceFile`, and when `plugins` is not an
 *  array. An entry with no string `name` is not in the result. */
export function readEntrySources(
  settingsFile: string,
  source: unknown,
): ReadonlyMap<string, readonly unknown[]> | undefined {
  const found = locate(settingsFile, source)
  if (found.kind !== 'data' || !Array.isArray(found.data.plugins)) {
    return undefined
  }
  const sources = new Map<string, unknown[]>()
  for (const entry of found.data.plugins as unknown[]) {
    if (isObject(entry) && typeof entry.name === 'string') {
      const list = sources.get(entry.name) ?? []
      list.push(entry.source)
      sources.set(entry.name, list)
    }
  }
  return sources
}

/** The `extraKnownMarketplaces` object of parsed settings, or undefined. */
function marketplacesIn(settings: unknown): Record<string, unknown> | undefined {
  return isObject(settings) && isObject(settings.extraKnownMarketplaces)
    ? settings.extraKnownMarketplaces
    : undefined
}

/** The `extraKnownMarketplaces` object in the settings `text`, or undefined
 *  when there is none. Two members of one key read as the last, as
 *  `JSON.parse` does. */
export function marketplacesOf(text: string): Record<string, unknown> | undefined {
  try {
    return marketplacesIn(JSON.parse(text))
  } catch {
    return undefined
  }
}

/** The `source` value of one `extraKnownMarketplaces` entry. */
export function sourceOf(entry: unknown): unknown {
  return isObject(entry) ? entry.source : undefined
}

/** The `source` value of the marketplace `market`, as the project settings
 *  files of one `.claude/` declare it. `settingsFile` is the linted file, and
 *  `text` is its text. The settings reference says that Claude Code uses a
 *  same-name entry "from the highest-precedence file whole". The local file
 *  is above `settings.json`. So `settings.local.json` decides when it has the
 *  key. Otherwise `settings.json` decides. The result is undefined when no
 *  file has the key. It is also undefined when `settings.local.json` is a
 *  dangling link, has a real path out of the bound, fails to read, or does
 *  not parse to an object, because it can hold the entry in use. It is also
 *  undefined when it is not there and its path is out of the bound. A missing
 *  `settings.local.json` in the bound has no entry. */
export function declaredSource(settingsFile: string, text: string, market: string): unknown {
  const own = marketplacesOf(text)
  const ownHas = own !== undefined && Object.hasOwn(own, market)
  const project = path.basename(settingsFile) === 'settings.json'
  if (!project && ownHas) {
    return sourceOf(own[market])
  }
  const other = path.join(
    path.dirname(settingsFile),
    project ? 'settings.local.json' : 'settings.json',
  )
  const parsed = readJson(other, boundOf(settingsFile))
  // A file that does not parse to an object is no file whose entry the rule can compare.
  if (parsed === UNREADABLE || (parsed !== null && !isObject(parsed.data))) {
    return undefined
  }
  const there = parsed === null ? undefined : marketplacesIn(parsed.data)
  if (project && there !== undefined && Object.hasOwn(there, market)) {
    return sourceOf(there[market])
  }
  if (project) {
    return ownHas ? sourceOf(own[market]) : undefined
  }
  // `sourceOf` gives undefined for a key of the prototype, which is no object with a `source`.
  return sourceOf(there?.[market])
}

/** The marketplace names that `data`, the parsed settings of one file, declares in
 *  `extraKnownMarketplaces`, or in `additionalMarketplaces` when the canonical key
 *  is not there. A `null` value declares nothing. */
function namesIn(data: Record<string, unknown>): string[] {
  const key = Object.hasOwn(data, 'extraKnownMarketplaces')
    ? data.extraKnownMarketplaces
    : data.additionalMarketplaces
  return isObject(key) ? Object.keys(key).filter((name) => key[name] !== null) : []
}

/** The marketplace names that the project settings files of one `.claude/`
 *  declare together: the linted file `settingsFile` with the text `text`, and
 *  the other file of the pair. A name in either file counts, because the
 *  settings reference resolves a same-name entry for each name and not for
 *  the whole key. The result is `UNREADABLE` when the rule cannot see a part.
 *  This covers text that does not parse to an object, and another file that
 *  is a dangling link, has a real path out of the bound, fails to read, or does
 *  not parse to an object. Another file that is not there, with its path in
 *  the bound, declares nothing. */
export function declaredMarketplaces(settingsFile: string, text: string): Set<string> | Unreadable {
  let own: unknown
  try {
    own = JSON.parse(text)
  } catch {
    return UNREADABLE
  }
  const other = path.join(
    path.dirname(settingsFile),
    path.basename(settingsFile) === 'settings.json' ? 'settings.local.json' : 'settings.json',
  )
  const parsed = readJson(other, boundOf(settingsFile))
  if (!isObject(own) || parsed === UNREADABLE) {
    return UNREADABLE
  }
  if (parsed === null) {
    return new Set(namesIn(own))
  }
  return isObject(parsed.data) ? new Set([...namesIn(own), ...namesIn(parsed.data)]) : UNREADABLE
}

/** The `source.source` value that the project settings files in `root`
 *  declare for the marketplace `market`, or undefined. `root` is a directory
 *  that may hold `.claude/`. The files are the two of that `.claude/`, with
 *  the precedence of `declaredSource`. The result is undefined when no file
 *  declares `market`. It is also undefined when `settings.local.json` cannot
 *  be read, because that file can hold the entry in use. A `settings.json`
 *  that cannot be read, or does not parse, declares nothing. Then
 *  `settings.local.json` still decides when it has the key. */
export function declaredSourceType(root: string, market: string): unknown {
  const file = path.join(root, '.claude', 'settings.json')
  const own = readJson(file, boundOf(file))
  const data = own === null || own === UNREADABLE ? undefined : own.data
  const source = declaredSource(file, data === undefined ? '' : JSON.stringify(data), market)
  return isObject(source) ? source.source : undefined
}
