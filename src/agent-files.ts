// Find out if a file is a subagent file or an output style file. The globs of
// the rules are broad, so each rule asks here where the file sits (ADR 001,
// Decision 10). A plugin root is found by its manifest. A root that the check
// cannot see gives null. An agent file also gives its scope root. The manifest
// key `agents` of a plugin names its agent files. It replaces the `agents/`
// directory scan (https://code.claude.com/docs/en/plugins/manifest-reference#how-each-key-combines-with-its-default-location).
// The fields table of that page says that the key takes `.md` files and no directory.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import {
  isInside,
  missingOf,
  readManifest,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

export interface ClaudeFile {
  /** True when the file is in a plugin. */
  plugin: boolean
}

/** A subagent file: where it sits, and the directory that holds its `agents/`
 *  directory. A rule that compares an agent with other files of its scope
 *  reads the root. */
export interface AgentFile extends ClaudeFile {
  /** The `.claude/` directory of a local agent, or the root of a plugin. */
  root: string
}

/** Where the directory `dir` sits: in `.claude/`, in a plugin root, or
 *  neither. The result is `UNREADABLE` when the check cannot see the plugin
 *  root. */
function scopeOf(dir: string): ClaudeFile | null | Unreadable {
  const parent = path.dirname(dir)
  if (path.basename(parent) === '.claude') {
    return { plugin: false }
  }
  const root = isPluginRoot(parent)
  return root === UNREADABLE ? UNREADABLE : root ? { plugin: true } : null
}

/** The directories from the directory of `file` up to the repository root,
 *  nearest first. The walk stops at the first directory that holds `.git`, so
 *  no call reaches a path above the repository (ADR 001, Decision 14). With no
 *  repository, the result is the directory of `file` alone. */
function directoriesUp(file: string): string[] {
  const chain: string[] = []
  for (let at = path.dirname(file); ; at = path.dirname(at)) {
    chain.push(at)
    if (existsSync(path.join(at, '.git'))) {
      return chain
    }
    if (path.dirname(at) === at) {
      return chain.slice(0, 1)
    }
  }
}

/** The agent files that the manifest key `agents` of the plugin root `root`
 *  names, as absolute paths. The result is null when the manifest has no
 *  `agents` key, and the `agents/` directory then holds the agents. The result
 *  is `UNREADABLE` when the check cannot tell which files load: the manifest
 *  cannot be read, or `agents` is neither a path nor a list of paths. A path
 *  loads only when it starts with `./`, ends in `.md`, and stays in the plugin
 *  root. The check drops any other path, as Claude Code does. */
export function manifestAgents(root: string, bound: string): string[] | null | Unreadable {
  const manifest = readManifest(root, bound)
  if (manifest === UNREADABLE || manifest === null) {
    return UNREADABLE
  }
  if (!('agents' in manifest)) {
    return null
  }
  const entries: unknown[] = Array.isArray(manifest.agents) ? manifest.agents : [manifest.agents]
  if (!entries.every((entry) => typeof entry === 'string')) {
    return UNREADABLE
  }
  const base = path.resolve(root)
  const files = new Set<string>()
  for (const entry of entries) {
    const file = path.resolve(base, entry)
    if (entry.startsWith('./') && entry.endsWith('.md') && isInside(file, base)) {
      files.add(file)
    }
  }
  return [...files]
}

/** What the check sees of the agent file `file` of the plugin root `root`: `present`, `absent`
 *  (not on disk, as in an editor buffer, with a path in `bound`), `outside` (a link whose target is
 *  in `bound` but out of `root`, which Claude Code does not load), or `UNREADABLE`. A dangling link,
 *  a real path out of `bound` and a read that fails give `UNREADABLE`. */
export function agentFileState(
  file: string,
  bound: string,
  root: string,
): 'present' | 'absent' | 'outside' | Unreadable {
  const real = realOf(file)
  if (real === UNREADABLE) {
    return UNREADABLE
  }
  if (real === null) {
    return missingOf(file, bound) === null ? 'absent' : UNREADABLE
  }
  if (!isInside(real, bound)) {
    return UNREADABLE
  }
  return isInside(real, realDirectory(root)) ? 'present' : 'outside'
}

/** Gives `found` when the manifest of the plugin root `found.root` loads `file`. The `agents/`
 *  directory holds the agents when the manifest has no `agents` key, or when the check cannot
 *  read it. When the key names files, only those files are agents, so the result is null for
 *  `file` unless it is one of them. */
function loadedBy(found: AgentFile, file: string, inFolder: boolean): AgentFile | null {
  const bound = repositoryRoot(found.root)
  const listed = manifestAgents(found.root, bound)
  if (!Array.isArray(listed)) {
    return inFolder ? found : null
  }
  if (!listed.includes(file)) {
    return null
  }
  const state = agentFileState(file, bound, found.root)
  return state === 'present' || state === 'absent' ? found : null
}

/** What `file` is: a subagent file in `.claude/agents/`, in the `agents/`
 *  directory of a plugin at any depth, or a file that the manifest key `agents`
 *  of a plugin names, or null. The result is also null when the plugin root of
 *  the file is unseen. The root is the parent of the deepest `agents/`
 *  directory that fits, or the plugin root of the manifest. */
export function classifyAgentFile(file: string): AgentFile | null {
  const resolved = path.resolve(file)
  // The deepest `agents/` directory that fits is the one that counts. The
  // loop ends at the root of the file system, which is its own parent.
  for (let dir = path.dirname(resolved); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (path.basename(dir) !== 'agents') {
      continue
    }
    const scope = scopeOf(dir)
    // The walk stops at a root that the check cannot see. It does not go on to an
    // `agents/` directory above it.
    if (scope === UNREADABLE) {
      return null
    }
    if (scope !== null) {
      const found = { ...scope, root: path.dirname(dir) }
      return scope.plugin ? loadedBy(found, resolved, true) : found
    }
  }
  // A file outside `agents/` is an agent only when the nearest plugin root names it.
  for (const dir of directoriesUp(resolved)) {
    const plugin = isPluginRoot(dir)
    if (plugin === UNREADABLE) {
      return null
    }
    if (plugin) {
      return loadedBy({ plugin: true, root: dir }, resolved, false)
    }
  }
  return null
}

/** What `file` is: an output style file directly in `.claude/output-styles/`
 *  or in the `output-styles/` directory of a plugin, or null. The result is also
 *  null when the plugin root of the file is unseen. */
export function classifyOutputStyle(file: string): ClaudeFile | null {
  const dir = path.dirname(path.resolve(file))
  if (path.basename(dir) !== 'output-styles') {
    return null
  }
  const scope = scopeOf(dir)
  return scope === UNREADABLE ? null : scope
}

// The result for each parse of a file. A rule asks for it once for each file that it lints.
// The five rules with the glob `**/*.md` ask for the same file, so one walk serves all five. The
// key is the parse of the file, which is new for each lint run, so a change to a manifest shows.
const classified = new WeakMap<object, AgentFile | null>()

/** `classifyAgentFile` for the file of a lint run, with the result kept for the other rules that
 *  lint the same parse. */
export function classifyLinted(context: {
  filename: string
  sourceCode: object
}): AgentFile | null {
  const { sourceCode } = context
  let found = classified.get(sourceCode)
  if (found === undefined) {
    found = classifyAgentFile(context.filename)
    classified.set(sourceCode, found)
  }
  return found
}
