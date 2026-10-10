// The repository scripts that a command names. A hook command, and the command
// of a status line, can name a script by the project variable, by the plugin
// variable, or by a path from the project. The hooks reference lists the two
// variables (https://code.claude.com/docs/en/hooks#reference-scripts-by-path).
//
// A rule reads a script only when its path is in the repository (ADR 001,
// Decision 14). A path in a user directory, an absolute path, a glob, and a
// word with a variable or a shell expansion that the rule cannot resolve are
// not scripts here.
import path from 'node:path'
import { realSource } from './marketplace-source.ts'
import { isPluginRoot } from './plugin-root.ts'
import { kindOf } from './settings-files.ts'
import {
  isInside,
  realDirectory,
  repositoryRoot,
  UNREADABLE,
  type Unreadable,
} from './skill-tree.ts'

/** A word of a command, with the node that a report points at. */
export interface Word<N> {
  text: string
  node: N
}

// The characters that end a word in a shell command, outside quotes.
const SEPARATOR = /[\s|&;<>()]/

interface Scan {
  words: string[]
  word: string | null
  /** True when the word to come is the target of a redirect. */
  redirect: boolean
}

/** End the word of `scan`. The target of a redirect is not a word of the
 *  command. */
function settle(scan: Scan): void {
  if (scan.word !== null) {
    if (!scan.redirect) {
      scan.words.push(scan.word)
    }
    scan.redirect = false
    scan.word = null
  }
}

/** The words of the shell command `command`. A quote joins the characters in
 *  it to one word, and the quote itself is not in the word. An operator ends a
 *  word. The scan does not model a variable, a substitution or an escape. The
 *  target of a redirect is left out. */
export function wordsOf(command: string): string[] {
  const scan: Scan = { words: [], word: null, redirect: false }
  let quote = ''
  for (const char of command) {
    if (quote !== '') {
      if (char === quote) {
        quote = ''
      } else {
        scan.word = (scan.word as string) + char
      }
    } else if (char === '"' || char === "'") {
      quote = char
      scan.word ??= ''
    } else if (SEPARATOR.test(char)) {
      settle(scan)
      scan.redirect ||= char === '<' || char === '>'
    } else {
      scan.word = (scan.word ?? '') + char
    }
  }
  settle(scan)
  return scan.words
}

/** A directory that a path resolves from, and the directory that the path
 *  must stay in. */
interface Base {
  dir: string
  limit: string
}

/** Where the paths of one file resolve.
 *  - `bound`: the repository root. A rule reads nothing out of it.
 *  - `project`: `${CLAUDE_PROJECT_DIR}`, or null when the file has no project.
 *  - `plugin`: `${CLAUDE_PLUGIN_ROOT}`, or null when the file is in no plugin.
 *  - `relative`: a path from the project, or null when its cwd is not known. */
export interface Scope {
  bound: string
  project: Base | null
  plugin: Base | null
  relative: Base | null
}

/** The scope of the settings file `filename`. A project or local file has the
 *  parent of its `.claude/` directory as the project. A managed file has no
 *  project of its own. Claude Code runs it in any project, so its project is
 *  the repository that holds the file, and it has no relative path. */
export function settingsScope(filename: string): Scope {
  const file = path.resolve(filename)
  const managed = kindOf(file) === 'managed'
  // A drop-in sits in `managed-settings.d/`, beside `managed-settings.json`.
  const inDropIn = path.basename(path.dirname(file)) === 'managed-settings.d'
  const dir = managed && !inDropIn ? path.dirname(file) : path.dirname(path.dirname(file))
  const project = realDirectory(dir)
  const bound = repositoryRoot(project)
  const base = { dir: managed ? bound : project, limit: bound }
  return { bound, project: base, plugin: null, relative: managed ? null : base }
}

/** The scope of `hooks/hooks.json` in a plugin, or null when `filename` is not
 *  in a plugin root, or the rule cannot see whether it is. Claude Code copies
 *  a plugin to a cache, so a path must stay in the plugin root. */
function pluginScope(filename: string): Scope | null {
  const root = realDirectory(path.dirname(path.dirname(path.resolve(filename))))
  if (isPluginRoot(root) !== true) {
    return null
  }
  return {
    bound: repositoryRoot(root),
    project: null,
    plugin: { dir: root, limit: root },
    relative: null,
  }
}

/** The scope of the hooks file `filename`: `hooks/hooks.json` in a plugin, or
 *  a settings file. The result is null for a plugin file that is in no plugin
 *  root. */
export function hooksScope(filename: string): Scope | null {
  const file = path.resolve(filename)
  return path.basename(file) === 'hooks.json' && path.basename(path.dirname(file)) === 'hooks'
    ? pluginScope(file)
    : settingsScope(file)
}

const PLACEHOLDER =
  /^\$(?:\{(CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT)\}|(CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT))\/(.+)$/
// A path with one of these characters has a variable, a glob, a home path, a
// Windows separator or an assignment. The rule cannot resolve it.
const UNRESOLVED = /[$`*?[\]{}\\~:=!#]/

/** The absolute path that the word `text` names, or null when `text` is not a
 *  repository path. A word names a path when it starts with a project or plugin
 *  variable. The first word, the program, also names a path when it has a `/`
 *  and does not start with one. */
function pathOf(text: string, first: boolean, scope: Scope): string | null {
  const match = PLACEHOLDER.exec(text)
  let base: Base | null
  let rest: string
  if (match !== null) {
    base = (match[1] ?? match[2]) === 'CLAUDE_PLUGIN_ROOT' ? scope.plugin : scope.project
    rest = match[3] as string
  } else if (first && text.includes('/') && !text.startsWith('/')) {
    base = scope.relative
    rest = text
  } else {
    return null
  }
  if (base === null || UNRESOLVED.test(rest) || rest.endsWith('/')) {
    return null
  }
  const file = path.resolve(base.dir, rest)
  return isInside(file, base.limit) ? file : null
}

/** A word that names a repository script. `first` is true for the program. */
export interface ScriptRef<N> {
  word: string
  file: string
  first: boolean
  node: N
}

/** The words of a command that name a repository script, in order. */
export function scriptRefs<N>(words: Word<N>[], scope: Scope): ScriptRef<N>[] {
  return words.flatMap(({ text, node }, index) => {
    const file = pathOf(text, index === 0, scope)
    return file === null ? [] : [{ word: text, file, first: index === 0, node }]
  })
}

/** The real path of the script `file`, null when it is not there, or
 *  `UNREADABLE` when the rule cannot see it. The rule cannot see a path with a
 *  dangling link in it, a real path out of the repository, or a part that
 *  fails to read. */
export function realScript(file: string, scope: Scope): string | null | Unreadable {
  const found = realSource(scope.bound, scope.bound, scope.bound, file)
  if (typeof found === 'string') {
    return found
  }
  return found.kind === 'missing' ? null : UNREADABLE
}
