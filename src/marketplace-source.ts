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
  realDirectory,
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
 *    is also here: `marketplace-relative-source-backslash` owns it.
 *  - `missing`: nothing is at the path.
 *  - `escapes`: the real path is out of the marketplace root and inside the
 *    repository. A link on the path leads out.
 *  - `unreadable`: the rule cannot see the source. The path is a dangling
 *    link, has a real path out of the repository, or fails to read. Or
 *    `plugin.json` is unreadable (see `readManifest`).
 *  - `no-manifest`: the source has no `.claude-plugin/plugin.json`. A source
 *    that is a file is here too.
 *  - `manifest`: the fields of `plugin.json`. */
export type SourceRead =
  | { kind: 'not-relative' }
  | { kind: 'missing' }
  | { kind: 'escapes' }
  | { kind: 'unreadable' }
  | { kind: 'no-manifest' }
  | { kind: 'manifest'; manifest: Record<string, unknown> }

const NOT_RELATIVE: SourceRead = { kind: 'not-relative' }
const MISSING: SourceRead = { kind: 'missing' }
const ESCAPES: SourceRead = { kind: 'escapes' }
const CANNOT_SEE: SourceRead = { kind: 'unreadable' }
const NO_MANIFEST: SourceRead = { kind: 'no-manifest' }

/** True when `text` has no fault that the format rule reports and has no
 *  backslash. */
function plain(text: string): boolean {
  return pathFault(text) === undefined && !text.includes('\\')
}

/** The path of the source `text` from the marketplace root, or undefined when
 *  `text` is not a relative path. A bare name resolves under `pluginRoot`. A
 *  path that starts with `./`, and `.`, do not change (marketplace reference,
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

/** The real path of the directory `dir` below `root`, or the result that stops
 *  the read. The walk goes down one part at a time. A part that does not
 *  resolve is either not there, or a dangling link, and a dangling link can
 *  lead anywhere (as in `readJson`). */
function realSource(root: string, realRoot: string, dir: string): string | SourceRead {
  let at = root
  let real = realRoot
  for (const part of path.relative(root, dir).split(path.sep).filter(Boolean)) {
    at = path.join(at, part)
    const found = realOf(at)
    if (typeof found !== 'string') {
      return found === null && danglingOf(at) === null ? MISSING : CANNOT_SEE
    }
    real = found
  }
  return real
}

/** The reader for the marketplace file `file` with the document `document`.
 *  The result reads the source of an entry. */
export function sourceReader(
  file: string,
  document: DocumentNode,
): (entry: ObjectNode) => SourceRead {
  const root = path.dirname(path.dirname(path.resolve(file)))
  const realRoot = realDirectory(root)
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
    const dir = path.resolve(root, relative)
    const real = realSource(root, realRoot, dir)
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
