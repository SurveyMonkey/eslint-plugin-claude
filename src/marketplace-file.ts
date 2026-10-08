// The reader of a `marketplace.json` that a project settings file points at.
// An `extraKnownMarketplaces` entry with a `file` or `directory` source names
// a local marketplace. A rule that compares a settings key with that
// marketplace asks here. The docs say that a relative path "resolves against
// your repository's main checkout" (plugins/org, "Require a marketplace and
// its plugins"). So a relative `path` resolves from the repository root of
// the settings file. With no `.git`, that root is the directory that holds
// `.claude/`. The reader reads the file through `readJson`, with the
// repository root as the bound (ADR 001, Decision 14).
import path from 'node:path'
import { readJson, repositoryRoot, UNREADABLE } from './skill-tree.ts'

/** What a rule sees at a local marketplace source. A rule makes no report
 *  except for `marketplace`.
 *
 *  - `not-local`: the source is not a `file` or `directory` source with a
 *    relative `path`. This covers every other source type, and a `path` that
 *    is absolute, empty or not a string.
 *  - `missing`: no `marketplace.json` is at the path.
 *  - `unreadable`: the rule cannot see the file. A link on the path is
 *    dangling, or the real path is out of the repository, or the read fails.
 *    The file does not parse to an object, or is no file.
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

const NOT_LOCAL: MarketplaceRead = { kind: 'not-local' }
const MISSING: MarketplaceRead = { kind: 'missing' }
const CANNOT_SEE: MarketplaceRead = { kind: 'unreadable' }

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The directory that holds the `.claude/` directory of the settings file `file`. */
const projectOf = (file: string) => path.dirname(path.dirname(path.resolve(file)))

/** True when `text` is an absolute path on any platform. The Windows form
 *  covers a path that starts with `/` too. */
const absolute = (text: string) => path.win32.isAbsolute(text)

/** Read the `marketplace.json` that `source` points at. `source` is the
 *  `source` value of an `extraKnownMarketplaces` entry in the settings file
 *  `settingsFile`, as `JSON.parse` gives it. A `file` source names the
 *  `marketplace.json` itself. A `directory` source names the marketplace
 *  root, the directory that holds `.claude-plugin/marketplace.json`
 *  (marketplace reference, "Fields by type"). */
export function readMarketplaceFile(settingsFile: string, source: unknown): MarketplaceRead {
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
  const bound = repositoryRoot(projectOf(settingsFile))
  const target = path.resolve(bound, given)
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
  const { name, plugins } = parsed.data
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
 *  file `settingsFile` declares it. `text` is the text of that file. The
 *  same file decides when it has the key. Otherwise the other project
 *  settings file of the same `.claude/` decides. The result is undefined when
 *  neither file has the key, and when the other file cannot be read. */
export function declaredSource(settingsFile: string, text: string, market: string): unknown {
  const own = marketplacesOf(text)
  if (own !== undefined && Object.hasOwn(own, market)) {
    return sourceOf(own[market])
  }
  const other = path.join(
    path.dirname(settingsFile),
    path.basename(settingsFile) === 'settings.json' ? 'settings.local.json' : 'settings.json',
  )
  const parsed = readJson(other, repositoryRoot(projectOf(settingsFile)))
  if (parsed === null || parsed === UNREADABLE) {
    return undefined
  }
  // `sourceOf` gives undefined for a key of the prototype, which is no object with a `source`.
  return sourceOf(marketplacesIn(parsed.data)?.[market])
}
