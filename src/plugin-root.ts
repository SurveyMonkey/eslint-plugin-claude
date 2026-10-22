// Find out if a directory is the root of a Claude Code plugin. A glob cannot
// see a sibling file, so a rule that needs plugin context asks here.
import { type BigIntStats, lstatSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  lastMember,
  type MarketplaceBody,
  type ObjectNode,
  pluginEntries,
} from './marketplace-json.ts'
import { type SourceRead, sourcePath, sourceReader } from './marketplace-source.ts'
import { jsonBodyState } from './mcp-servers.ts'
import {
  danglingOf,
  failure,
  isInside,
  readJson,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** True when `dir` is a plugin root, false when it is not, and `UNREADABLE`
 *  when the check cannot see. For the manifest, the check cannot see in two
 *  cases. A read of `.claude-plugin/` fails for a reason other than a missing
 *  file. Or `.claude-plugin/` has a real path out of the repository (ADR 001,
 *  Decision 14). For a marketplace, see `isListed`. A caller makes no report
 *  on such a directory. It does not use the local logic of an outer
 *  `.claude/` directory.
 *
 *  `UNREADABLE` is a truthy symbol. Test the result with `=== true`, or
 *  compare it to `UNREADABLE` first.
 *
 *  A `.claude-plugin/plugin.json` of any file type makes a plugin root. The
 *  check follows no link at that last step, so a link to any target counts,
 *  and a dangling link too. `readManifest` reads the content.
 *
 *  A directory with no manifest is a plugin root when a `marketplace.json` of
 *  the repository lists it (see `isListed`). */
export function isPluginRoot(dir: string): boolean | Unreadable {
  const manifest = hasManifest(dir)
  return manifest === false ? isListed(dir) : manifest
}

/** The manifest part of `isPluginRoot`: true when `dir` holds a
 *  `.claude-plugin/plugin.json` entry. A rule that needs a manifest, and not
 *  only a plugin root, asks here. */
export function hasManifest(dir: string): boolean | Unreadable {
  const real = realOf(path.join(dir, '.claude-plugin'))
  if (typeof real !== 'string') {
    return real ?? false
  }
  if (!isInside(real, repositoryRoot(dir))) {
    return UNREADABLE
  }
  try {
    lstatSync(path.join(real, 'plugin.json'))
    return true
  } catch (error) {
    return failure(error) ?? false
  }
}

/** The entry keys that replace a default location of a plugin. With no
 *  `plugin.json`, the entry is the manifest. The location checks, such as
 *  `classifyAgentFile` and `mcpFileKind`, read the component keys from
 *  `plugin.json` only. So they cannot model the plugin of an entry with one
 *  of these keys, and the check gives `UNREADABLE` for its directory.
 *  A `skills` key adds to the default in a manifest. It replaces the default
 *  in an entry whose source is the marketplace root. The check does not tell
 *  the two apart, so `skills` is here for each entry. The keys
 *  `experimental.themes` and `experimental.monitors` replace the folders
 *  `themes/` and `monitors/`. The top-level `themes` and `monitors` keys still
 *  load, so they are here too (Fields table, `experimental.themes`).
 *  (https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location,
 *  https://code.claude.com/docs/en/plugins/manifest-reference#how-entry-fields-combine-with-plugin-json,
 *  https://code.claude.com/docs/en/plugins/manifest-reference#fields) */
const REPLACES: readonly string[] = [
  'commands',
  'agents',
  'skills',
  'outputStyles',
  'workflows',
  'experimental',
  'themes',
  'monitors',
]

/** What the check knows of one `marketplace.json`. `stamp` is the time of the
 *  last write and the size of the file when the check parsed it. `roots` holds
 *  the real paths of the sources that resolve. `replaced` holds them for the
 *  entries with a key of `REPLACES`. `pending` holds the entries with
 *  a source that is missing, or that the check cannot see. `unseen` holds the
 *  entries of `pending` that the check could not see at the last read. */
interface Listing {
  readonly stamp: string
  readonly read: (entry: ObjectNode) => SourceRead
  readonly pathOf: (entry: ObjectNode) => string | undefined
  readonly roots: Set<string>
  readonly replaced: Set<string>
  pending: readonly ObjectNode[]
  unseen: readonly ObjectNode[]
}

// The listing of each `marketplace.json`, by path. A listing is current while
// its stamp is the same, as in `frontmatterOfFile`. Each call reads the pending
// entries again, so a plugin directory that a user adds later shows.
const listings = new Map<string, Listing>()

/** Read the pending entries of `listing` again, and move each source that now
 *  resolves to `roots`, or to `replaced`. */
function settle(listing: Listing): void {
  const unseen: ObjectNode[] = []
  listing.pending = listing.pending.filter((entry) => {
    const found = listing.read(entry)
    if (found.kind === 'manifest' || found.kind === 'no-manifest') {
      const replaces = REPLACES.some((key) => lastMember(entry, key) !== undefined)
      const into = replaces ? listing.replaced : listing.roots
      into.add(found.dir)
      return false
    }
    if (found.kind === 'unreadable') {
      unseen.push(entry)
    }
    return found.kind === 'missing' || found.kind === 'unreadable'
  })
  listing.unseen = unseen
}

/** A new listing of `document`, the content of the `marketplace.json` at
 *  `file`. */
function listingOf(file: string, stamp: string, document: MarketplaceBody): Listing {
  return {
    stamp,
    read: sourceReader(file, document),
    pathOf: sourcePath(file, document),
    roots: new Set(),
    replaced: new Set(),
    pending: pluginEntries(document),
    unseen: [],
  }
}

/** True when the file at `file` is there and is not JSON. `jsonBodyState`
 *  gives `UNREADABLE` for such a file, and for a file that it cannot read. */
function doesNotParse(file: string, bound: string): boolean {
  const parsed = readJson(file, bound)
  return typeof parsed === 'object' && parsed !== null && parsed.data === undefined
}

/** The listing of the `marketplace.json` at `file`, with its pending entries
 *  read again. The result is null when no file is there. It is `UNREADABLE`
 *  when the check cannot see the file. A read fails, the file is a dangling
 *  link, or its real path is out of `bound`. A file that does not parse lists
 *  no source, as Claude Code loads no plugin from it. */
function listedAt(file: string, bound: string): Listing | null | Unreadable {
  let stat: BigIntStats
  try {
    stat = statSync(file, { bigint: true })
  } catch (error) {
    listings.delete(file)
    // `statSync` follows a link, so a dangling link gives a missing file. `danglingOf` tells them
    // apart. A dangling `.claude-plugin/` holds no file, as in `hasManifest`.
    return failure(error) ?? danglingOf(file)
  }
  const stamp = `${stat.mtimeNs}:${stat.size}`
  let listing = listings.get(file)
  if (listing?.stamp !== stamp) {
    listings.delete(file)
    const body = jsonBodyState(file, bound)
    // A null here is a file that a process removed after the stat.
    if (body === UNREADABLE ? !doesNotParse(file, bound) : body === null) {
      return UNREADABLE
    }
    listing = listingOf(file, stamp, body === UNREADABLE || body === null ? {} : { body })
    listings.set(file, listing)
  }
  settle(listing)
  return listing
}

/** True when a `.claude-plugin/marketplace.json` at `dir` or above it lists
 *  `dir`. The marketplace reference says that a relative source is "A
 *  directory inside the marketplace, resolved from the marketplace root". So
 *  only a marketplace root at or above `dir` can list it. The walk stops at
 *  the repository root (ADR 001, Decision 14). With no `.git`, it reads the
 *  marketplace of `dir` only. The manifest reference says that "The manifest
 *  is optional", and that Claude Code then loads the standard layout.
 *
 *  The result is `UNREADABLE` when one of three cases occurs in any
 *  marketplace of the walk. The check cannot see the marketplace. Or an entry
 *  has the path `dir`, and the check cannot see its source. Or the source of
 *  an entry with a key of `REPLACES` is `dir`. A marketplace that lists `dir`
 *  as a plain root does not change this. So the walk goes to the repository
 *  root before the result can be true. */
function isListed(dir: string): boolean | Unreadable {
  const real = realOf(dir)
  if (typeof real !== 'string') {
    return false
  }
  const at = path.resolve(dir)
  const bound = repositoryRoot(dir)
  let listed = false
  let unseen = false
  for (let up = at; ; up = path.dirname(up)) {
    const listing = listedAt(path.join(up, '.claude-plugin', 'marketplace.json'), bound)
    if (listing === UNREADABLE) {
      unseen = true
    } else if (listing !== null) {
      listed ||= listing.roots.has(real)
      unseen ||=
        listing.replaced.has(real) || listing.unseen.some((entry) => listing.pathOf(entry) === at)
    }
    // `repositoryRoot` is the real path of `dir` or of a directory above it, so the walk ends.
    if (realDirectory(up) === bound) {
      return unseen ? UNREADABLE : listed
    }
  }
}
