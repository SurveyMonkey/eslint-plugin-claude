// The reader of the source of a relative plugin entry in `marketplace.json`.
// A rule that compares an entry with the `plugin.json` of its source asks
// here. The reader resolves the source from the marketplace root, the
// directory that holds `.claude-plugin/`. It reads `plugin.json` through
// `readManifest`, with the repository of the marketplace as the bound
// (ADR 001, Decision 14). With no `.git`, the bound is the marketplace root.
import path from 'node:path'
import { type DocumentNode, lastMember, type ObjectNode } from './marketplace-json.ts'
import { BARE_NAME, pathFault } from './rules/marketplace-relative-source-format.ts'
import {
  danglingOf,
  isInside,
  readManifest,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from './skill-tree.ts'

/** What a rule sees at the source of an entry. A rule makes no report that
 *  rests on `unreadable`.
 *
 *  - `not-relative`: the `source` is not a plain relative path. This covers
 *    a value that is not a string, and a path that
 *    `marketplace-relative-source-format` reports. A path with a backslash
 *    is also here. `marketplace-relative-source-backslash` owns it (`docs/rules-inventory.md`). A bare
 *    name is also here when no valid `pluginRoot` is set.
 *  - `missing`: nothing is at the path.
 *  - `escapes`: the real path is out of the marketplace root and inside the
 *    repository. A link on the path leads out.
 *  - `unreadable`: the rule cannot see the source. The marketplace root has
 *    no real path, or a real path out of the repository. A part of the path
 *    is a dangling link, has a real path out of the repository, or fails to
 *    read. Or `plugin.json` is unreadable (see `readManifest`).
 *  - `no-manifest`: the source has no `.claude-plugin/plugin.json`. A source
 *    that is a file is here too.
 *  - `manifest`: the fields of `plugin.json`. */
export type SourceRead =
  | { readonly kind: 'not-relative' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'escapes' }
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'no-manifest' }
  | { readonly kind: 'manifest'; readonly manifest: Readonly<Record<string, unknown>> }

const NOT_RELATIVE: SourceRead = { kind: 'not-relative' }
const MISSING: SourceRead = { kind: 'missing' }
const ESCAPES: SourceRead = { kind: 'escapes' }
const CANNOT_SEE: SourceRead = { kind: 'unreadable' }
const NO_MANIFEST: SourceRead = { kind: 'no-manifest' }

/** True when `pathFault` finds no network, absolute or `..` fault in `text`,
 *  and `text` has no backslash. */
function plain(text: string): boolean {
  return pathFault(text) === undefined && !text.includes('\\')
}

/** The path of the source `text` from the marketplace root, or undefined when
 *  `text` is not a relative path. A bare name resolves under `pluginRoot`. A
 *  path that starts with `./`, or is `.`, stays as it is (marketplace reference,
 *  "Bare names under pluginRoot"). */
function relativePath(text: string, pluginRoot: string | undefined): string | undefined {
  if (!plain(text)) {
    return undefined
  }
  if (text === '.' || text.startsWith('./')) {
    return text
  }
  return pluginRoot !== undefined && BARE_NAME.test(text) ? `${pluginRoot}/${text}` : undefined
}

/** The real path of `dir` below `root`, or the result that stops the read. The
 *  walk goes down one part at a time. A part that does not resolve is either
 *  not there, or a dangling link, and a dangling link can lead anywhere (as in
 *  `readJson`). A part that fails to read for another reason gives
 *  `unreadable`. A part with a real path out of the
 *  repository stops the walk, so the reader never looks below it. */
function realSource(
  root: string,
  realRoot: string,
  bound: string,
  dir: string,
): string | SourceRead {
  let at = root
  let real = realRoot
  for (const part of path.relative(root, dir).split(path.sep).filter(Boolean)) {
    at = path.join(at, part)
    const found = realOf(at)
    if (typeof found !== 'string') {
      return found === null && danglingOf(at) === null ? MISSING : CANNOT_SEE
    }
    if (!isInside(found, bound)) {
      return CANNOT_SEE
    }
    real = found
  }
  return real
}

/** Return a function that reads the source of an entry in `document`. `file`
 *  is the path of the `marketplace.json` that holds `document`. */
export function sourceReader(
  file: string,
  document: DocumentNode,
): (entry: ObjectNode) => SourceRead {
  const root = path.dirname(path.dirname(path.resolve(file)))
  const realRoot = realOf(root)
  const bound = repositoryRoot(root)
  const configured = lastMember(lastMember(document.body, 'metadata')?.value, 'pluginRoot')?.value
  // A `pluginRoot` with a fault is for the format rule. A bare name under it is not read.
  const pluginRoot =
    configured?.type === 'String' && configured.value !== '' && plain(configured.value)
      ? configured.value
      : undefined
  return (entry) => {
    const source = lastMember(entry, 'source')?.value
    const relative = source?.type === 'String' ? relativePath(source.value, pluginRoot) : undefined
    if (relative === undefined) {
      return NOT_RELATIVE
    }
    // A marketplace root that is not on disk gives no answer for any source.
    // The same holds for a root with a real path out of the repository: a
    // missing part must not give `missing` from a look out of the repository.
    if (typeof realRoot !== 'string' || !isInside(realRoot, bound)) {
      return CANNOT_SEE
    }
    const dir = path.resolve(root, relative)
    const real = realSource(root, realRoot, bound, dir)
    if (typeof real !== 'string') {
      return real
    }
    if (!isInside(real, bound)) {
      return CANNOT_SEE
    }
    if (!isInside(real, realRoot)) {
      return ESCAPES
    }
    const manifest = readManifest(dir, bound)
    if (manifest === UNREADABLE) {
      return CANNOT_SEE
    }
    return manifest === null ? NO_MANIFEST : { kind: 'manifest', manifest }
  }
}
