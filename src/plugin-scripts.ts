// The scripts of a plugin that a command runs, for a rule that reads what a command does. A
// command names a script of the plugin with `${CLAUDE_PLUGIN_ROOT}/...` as its program, or as the
// first argument of an interpreter (`scriptRefs`). The reader gives the text of such a script. It
// reads only a regular text file with a real path in the plugin root, so it reads no file out of the
// repository (ADR 001, Decision 14). A script it cannot read is not in the result.
import { readFileSync } from 'node:fs'
import type { Plugin } from './plugin-manifest.ts'
import { realScript, type Scope, scriptRefs, wordsOf } from './script-refs.ts'
import { isInside, statOf } from './skill-tree.ts'

/** The largest script that the reader reads, in bytes. A larger file is not a script. */
export const MAX_SCRIPT_BYTES = 1_048_576

/** A script of a plugin: the word of the command that names it, the real path of the file, and
 *  its text. */
export interface PluginScript {
  readonly word: string
  readonly file: string
  readonly text: string
}

// The plugin variable at the start of a word, in the braced or the bare form, and a quote that
// ends it.
const ROOT = /^\$(?:\{CLAUDE_PLUGIN_ROOT\}|CLAUDE_PLUGIN_ROOT(?![A-Za-z0-9_]))["']?/

/** The rest of `word` after `${CLAUDE_PLUGIN_ROOT}`, or undefined when the word does not start
 *  with the variable. The rest is empty, or starts with `/`, or is another text (`${...}x`). */
export function afterRoot(word: string): string | undefined {
  const match = ROOT.exec(word)
  return match === null ? undefined : word.slice(match[0].length)
}

/** The text of the file `real`, or undefined when it is not a regular file, is larger than
 *  `MAX_SCRIPT_BYTES`, cannot be read, or holds a NUL character (a binary file). */
function textOf(real: string): string | undefined {
  const stat = statOf(real)
  if (typeof stat !== 'object' || stat === null || !stat.isFile() || stat.size > MAX_SCRIPT_BYTES) {
    return undefined
  }
  try {
    const text = readFileSync(real, 'utf8')
    return text.includes('\0') ? undefined : text
  } catch {
    return undefined
  }
}

/** The scripts of `plugin` that the shell command `command` runs, in order. */
export function pluginScripts(plugin: Plugin, command: string): PluginScript[] {
  const scope: Scope = {
    bound: plugin.bound,
    project: null,
    plugin: { dir: plugin.realRoot, limit: plugin.realRoot },
    relative: null,
  }
  const words = wordsOf(command).map((text) => ({ text, node: null }))
  return scriptRefs(words, scope).flatMap(({ word, file }) => {
    const real = realScript(file, scope)
    if (typeof real !== 'string' || !isInside(real, plugin.realRoot)) {
      return []
    }
    const text = textOf(real)
    return text === undefined ? [] : [{ word, file: real, text }]
  })
}
