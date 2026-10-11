// A `SessionStart` hook adds its stdout to the context of Claude. The hooks reference says that for instructions
// that never change, CLAUDE.md is the place: it loads without running a script. The memory page says that a
// `SessionStart` hook which prints `AGENTS.md` adds a second copy to the context once Claude reads `AGENTS.md`
// directly (docs/rules/hooks-sessionstart-static-context.md). The rule is a heuristic with two reports:
// - the handler only echoes text with no variable, and no other output field than `additionalContext`;
// - a command of the handler prints a file named `AGENTS.md`.
// No other rule reads a hook for `AGENTS.md`. The rules for `AGENTS.md` read the memory files.
import path from 'node:path'
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  objectField,
} from '../hooks-config.ts'
import { type HandlerText, placeholderFolders } from '../hooks-files.ts'
import { type Command, commandWordAt, isPrinter, printedBy, sinkOf } from '../shell-words.ts'

const name = 'hooks-sessionstart-static-context' as const

/** The commands that print a file to standard output. */
const FILE_PRINTERS = ['cat', 'head', 'tail', 'less', 'more', 'bat']

/** True when a command of `commands` prints a file named `AGENTS.md`. */
function printsAgentsFile(commands: Command[]): boolean {
  return commands.some(({ words }, index) => {
    const at = commandWordAt(words)
    return (
      FILE_PRINTERS.includes(path.posix.basename(words[at] ?? '')) &&
      sinkOf(commands, index) === 'stdout' &&
      words.slice(at + 1).some((word) => path.posix.basename(word) === 'AGENTS.md')
    )
  })
}

/** True when the JSON object `json` holds `additionalContext` and no other output. */
function onlyContext(json: Record<string, unknown>): boolean {
  const specific = objectField(json, 'hookSpecificOutput')
  return (
    Object.keys(json).join() === 'hookSpecificOutput' &&
    specific !== undefined &&
    Object.keys(specific).every((key) => key === 'hookEventName' || key === 'additionalContext') &&
    typeof specific.additionalContext === 'string' &&
    specific.additionalContext !== ''
  )
}

/** True when the text only echoes static text: each command is an `echo` or `printf` to standard output
 *  with no variable or substitution, and prints text, or JSON that holds `additionalContext` only. */
function onlyStaticText({ commands }: HandlerText): boolean {
  return (
    commands.length > 0 &&
    commands.every(
      ({ words }, index) => isPrinter(words) && sinkOf(commands, index) === 'stdout',
    ) &&
    printedBy(commands).every(
      ({ json, text }) =>
        !/[$`]/.test(text) && (json === undefined ? text !== '' : onlyContext(json)),
    )
  )
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Put static SessionStart context in CLAUDE.md, and do not print AGENTS.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      staticText:
        'This SessionStart hook only prints text that never changes. Put the text in CLAUDE.md. CLAUDE.md loads without running a script.',
      agentsFile:
        'This SessionStart hook prints AGENTS.md. Once Claude reads AGENTS.md directly, the hook adds a second copy to the context. Remove the hook.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, handler } of handlersOf(source)) {
        const output = commandOutput(handler, folders)
        if (event !== 'SessionStart' || output === undefined) {
          continue
        }
        // A handler that runs scripts prints what they print. The command line is only the launcher.
        const scripts = output.texts.filter(({ script }) => script !== undefined)
        const judged = scripts.length > 0 ? scripts : output.texts
        if (output.texts.some(({ commands }) => printsAgentsFile(commands))) {
          context.report({ loc: output.loc, messageId: 'agentsFile' })
        } else if (judged.every(onlyStaticText)) {
          context.report({ loc: output.loc, messageId: 'staticText' })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
