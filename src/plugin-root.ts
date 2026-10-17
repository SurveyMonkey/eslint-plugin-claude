// Find out if a directory is the root of a Claude Code plugin. A glob cannot
// see a sibling file, so a rule that needs plugin context asks here.
import { lstatSync, Stats } from 'node:fs'
import path from 'node:path'
import { type ObjectNode, pluginEntries } from './marketplace-json.ts'
import { type SourceRead, sourceReader } from './marketplace-source.ts'
import { readJsonBody } from './mcp-servers.ts'
import {
  failure,
  isInside,
  realDirectory,
  realOf,
  repositoryRoot,
  statOf,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** True when `dir` is a plugin root, false when it is not, and `UNREADABLE`
 *  when the check cannot see. The check cannot see in two cases. A read of
 *  `.claude-plugin/` fails for a reason other than a missing file. Or
 *  `.claude-plugin/` has a real path out of the repository (ADR 001,
 *  Decision 14). A caller makes no report on such a directory. It does not
 *  use the local logic of an outer `.claude/` directory.
 *
 *  `UNREADABLE` is a truthy symbol. Test the result with `=== true`, or
 *  compare it to `UNREADABLE` first.
 *
 *  A `.claude-plugin/plugin.json` entry makes a plugin root. The check
 *  follows no link at that last step, so a link to any target counts, and a
 *  dangling link too. `readManifest` reads the content.
 *
 *  A directory with no manifest is a plugin root when a `marketplace.json` of
 *  the repository lists it (see `isListed`). */
export function isPluginRoot(dir: string): boolean | Unreadable {
  const manifest = hasManifest(dir)
  return manifest === false ? isListed(dir) : manifest
}

/** The manifest part of `isPluginRoot`. */
function hasManifest(dir: string): boolean | Unreadable {
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

/** What the check knows of one `marketplace.json`. `stamp` is the time of the
 *  last write and the size of the file when the check parsed it. `roots` holds
 *  the real paths of the sources that resolve. `pending` holds the entries with
 *  a source that is missing, or that the check cannot see. */
interface Listing {
  readonly stamp: string
  readonly read: (entry: ObjectNode) => SourceRead
  readonly roots: Set<string>
  pending: readonly ObjectNode[]
}

const NONE: ReadonlySet<string> = new Set()

// The listing of each `marketplace.json`, by path. A listing is current while
// its stamp is the same, as in `frontmatterOfFile`. Each call reads the pending
// entries again, so a plugin directory that a user adds later shows.
const listings = new Map<string, Listing>()

/** Read the pending entries of `listing` again, and move each source that now
 *  resolves to `roots`. */
function settle(listing: Listing): void {
  listing.pending = listing.pending.filter((entry) => {
    const found = listing.read(entry)
    if (found.kind === 'manifest' || found.kind === 'no-manifest') {
      listing.roots.add(found.dir)
      return false
    }
    return found.kind === 'missing' || found.kind === 'unreadable'
  })
}

/** The real paths of the plugin sources that the `marketplace.json` at `file`
 *  lists. `sourceReader` resolves each relative `source` from the marketplace
 *  root, inside the repository. A remote source, a source out of the
 *  marketplace root, and a source that the check cannot see give no path. A
 *  file that is not there, or that does not parse, gives none. */
function listedRoots(file: string, bound: string): ReadonlySet<string> {
  const stat = statOf(file)
  if (!(stat instanceof Stats)) {
    return NONE
  }
  const stamp = `${stat.mtimeMs}:${stat.size}`
  let listing = listings.get(file)
  if (listing?.stamp !== stamp) {
    const body = readJsonBody(file, bound)
    if (body === null) {
      return NONE
    }
    const document = { body }
    listing = {
      stamp,
      read: sourceReader(file, document),
      roots: new Set(),
      pending: pluginEntries(document),
    }
    listings.set(file, listing)
  }
  settle(listing)
  return listing.roots
}

/** True when a `.claude-plugin/marketplace.json` at `dir` or above it lists
 *  `dir`. The marketplace reference says that a relative source is "A
 *  directory inside the marketplace, resolved from the marketplace root". So
 *  only a marketplace root at or above `dir` can list it. The walk stops at
 *  the repository root (ADR 001, Decision 14). With no `.git`, it reads the
 *  marketplace of `dir` only. The manifest reference says that "The manifest
 *  is optional", and that Claude Code then loads the standard layout. */
function isListed(dir: string): boolean {
  const real = realOf(dir)
  if (typeof real !== 'string') {
    return false
  }
  const bound = repositoryRoot(dir)
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
    if (listedRoots(path.join(at, '.claude-plugin', 'marketplace.json'), bound).has(real)) {
      return true
    }
    // `repositoryRoot` is the real path of `dir` or of a directory above it, so the walk ends.
    if (realDirectory(at) === bound) {
      return false
    }
  }
}
