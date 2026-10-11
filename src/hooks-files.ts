// Find out if a `hooks.json` file is one that Claude Code reads. The globs of
// the rules are broad, so each rule asks here what the file is to Claude Code
// (ADR 001, Decision 10). A plugin reads `hooks/hooks.json` at its root. Project
// and user hooks go under the `hooks` key of a settings file, so there is no
// standalone hooks file for them (docs/rules/hooks-no-standalone-file.md).
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { isPluginRoot } from './plugin-root.ts'
import { kindOf } from './settings-files.ts'
import { commandsOf, commandWordAt } from './shell-words.ts'
import { isInside, readManifest, realOf, repositoryRoot, UNREADABLE } from './skill-tree.ts'

/** What Claude Code does with a `hooks.json` file. A plugin file is one that it
 *  reads. The other two kinds are files that it does not read: a standalone file in
 *  `.claude/`, and a file in `.claude-plugin/` that the manifest does not name. */
export type HooksFileKind = 'plugin' | 'project' | 'manifestDir'

/** True when the `hooks` key of the plugin manifest names `file`. The key is a
 *  path, or an array of paths and inline objects. A path is relative to the
 *  plugin root. */
function manifestNames(hooks: unknown, root: string, file: string): boolean {
  const entries = Array.isArray(hooks) ? hooks : [hooks]
  return entries.some((entry) => typeof entry === 'string' && path.resolve(root, entry) === file)
}

/** What the file `filename` is to Claude Code, or null. The result is null in three
 *  cases. The file is no `hooks.json`. No part of the layout names the file. Or the check
 *  cannot see (ADR 001, Decision 14). A rule makes no report on a null result.
 *
 *  A file under `.claude-plugin/` is read only when the manifest names it. The file
 *  `.claude/hooks/hooks.json` is read only when `.claude/` is itself a plugin root.
 *  A plugin reads no top-level `hooks.json` by default, so `.claude/hooks.json` is
 *  not read. Any other `hooks/hooks.json` is a plugin file, unless a hidden folder
 *  holds it. */
export function hooksFileKind(filename: string): HooksFileKind | null {
  const file = path.resolve(filename)
  if (path.basename(file) !== 'hooks.json') {
    return null
  }
  const dir = path.dirname(file)
  const inHooksDir = path.basename(dir) === 'hooks'
  // The directory that would be the plugin root if the file were the plugin file.
  const root = inHooksDir ? path.dirname(dir) : dir
  const holder = path.basename(root)
  if (holder === '.claude-plugin') {
    const plugin = path.dirname(root)
    const manifest = readManifest(plugin, repositoryRoot(plugin))
    if (manifest === UNREADABLE) {
      return null
    }
    return manifestNames(manifest?.hooks, plugin, file) ? 'plugin' : 'manifestDir'
  }
  if (holder === '.claude') {
    if (!inHooksDir) {
      return 'project'
    }
    const isRoot = isPluginRoot(root)
    return isRoot === UNREADABLE ? null : isRoot ? 'plugin' : 'project'
  }
  // Another hidden folder, such as `.github/hooks/`, holds the hooks of another tool.
  return inHooksDir && !holder.startsWith('.') ? 'plugin' : null
}

/** The project settings files that apply to a plugin in the folder `root`, nearest folder first. For each
 *  folder, the list holds `.claude/settings.json` and then `.claude/settings.local.json`. The folders are
 *  `root` and each folder above it, up to the folder that holds `.git` (the repository root). A project
 *  can keep a plugin in a sub folder. If the walk finds no `.git`, the list holds the files of `root`
 *  only (ADR 001, Decision 14). */
export function settingsFilesAround(root: string): string[] {
  const start = path.resolve(root)
  const folders: string[] = []
  for (let at = start; ; at = path.dirname(at)) {
    folders.push(at)
    if (existsSync(path.join(at, '.git'))) {
      break
    }
    if (path.dirname(at) === at) {
      folders.splice(0, folders.length, start)
      break
    }
  }
  return folders.flatMap((folder) =>
    ['settings.json', 'settings.local.json'].map((name) => path.join(folder, '.claude', name)),
  )
}

/** The folders that the path placeholders name for a hook in the file `filename`. A plugin `hooks.json`
 *  has a plugin root and no project folder. A project settings file, a skill and a subagent have the project
 *  folder above the nearest `.claude` folder, and no plugin root. A managed file has neither. */
export interface PlaceholderFolders {
  project?: string
  plugin?: string
}

export function placeholderFolders(
  filename: string,
  kind: 'settings' | 'plugin' | 'skill' | 'agent',
): PlaceholderFolders {
  const file = path.resolve(filename)
  if (kind === 'plugin') {
    return { plugin: path.dirname(path.dirname(file)) }
  }
  if (kind === 'settings' && kindOf(file) === 'managed') {
    return {}
  }
  for (let at = path.dirname(file); path.dirname(at) !== at; at = path.dirname(at)) {
    if (path.basename(at) === '.claude') {
      return { project: path.dirname(at) }
    }
  }
  return {}
}

const PLACEHOLDER_PATH =
  /^\$(?:\{(CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT)\}|(CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT))(\/.*)$/

/** A script that a hook runs: its absolute path, and the folder that the placeholder names. */
export interface HookScript {
  file: string
  folder: string
}

/** The script that the command word `word` names, or undefined. Only a path that starts with
 *  `${CLAUDE_PROJECT_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, with braces or without, has a place that the file shows. A path from the
 *  working directory has none. */
function placeholderPath(word: string, folders: PlaceholderFolders): HookScript | undefined {
  const match = PLACEHOLDER_PATH.exec(word)
  if (match === null) {
    return undefined
  }
  const folder = (match[1] ?? match[2]) === 'CLAUDE_PROJECT_DIR' ? folders.project : folders.plugin
  return folder === undefined ? undefined : { file: path.resolve(folder, `.${match[3]}`), folder }
}

const SHELLS = ['bash', 'sh', 'zsh']
/** The flags of a shell that take a value. The word after one is not the script. */
const VALUE_FLAGS = ['-o', '+o', '-O', '+O', '--rcfile', '--init-file']

/** The script that a shell runs, in the words after the shell name: the first word that is no flag. A flag
 *  cluster with `c` ends the search, because the next word is a command line. */
function shellScript(rest: string[]): string | undefined {
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i] as string
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(word)) {
      return undefined
    }
    if (VALUE_FLAGS.includes(word)) {
      i++
    } else if (!/^[-+]/.test(word)) {
      return word
    }
  }
  return undefined
}

/** The scripts that a command hook runs from the folders that the placeholders
 *  name. A script is the command word. With `viaShell`, it is also the script of `bash`, `sh` and `zsh`.
 *  `args` is set for exec form, where `command` is the program. */
export function scriptsRun(
  command: string,
  args: string[] | undefined,
  folders: PlaceholderFolders,
  viaShell: boolean,
): HookScript[] {
  const lines = args === undefined ? commandsOf(command) : [[command, ...args]]
  return lines.flatMap((words) => {
    const at = commandWordAt(words)
    const program = words[at] ?? ''
    const named = viaShell && SHELLS.includes(path.posix.basename(program))
    const script = placeholderPath(
      named ? (shellScript(words.slice(at + 1)) ?? '') : program,
      folders,
    )
    return script === undefined ? [] : [script]
  })
}

/** The largest script that a rule reads, in bytes. */
const MAX_SCRIPT = 1_000_000

/** The text of the script `script`, or undefined when a rule must not read it. The file must be a regular
 *  file with a real path in the repository of its folder, of at most one megabyte, and readable. A dangling
 *  link, a link out of the repository, a folder and a FIFO give undefined (ADR 001, Decision 14). */
export function scriptText({ file, folder }: HookScript): string | undefined {
  const real = realOf(file)
  if (typeof real !== 'string' || !isInside(real, repositoryRoot(folder))) {
    return undefined
  }
  try {
    const info = statSync(real)
    return info.isFile() && info.size <= MAX_SCRIPT ? readFileSync(real, 'utf8') : undefined
  } catch {
    return undefined
  }
}
