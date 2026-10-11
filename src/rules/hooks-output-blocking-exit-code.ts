// Claude Code treats exit code 1 as a non-blocking error, even though 1 is the usual failure code. A hook that
// means to block must exit 2 (docs/rules/hooks-output-blocking-exit-code.md). The rule is a heuristic. A script
// means to block when it writes a message to stderr and then exits with 1. The rule reads the inline command
// and the repository scripts that the command runs, on the events where exit 2 blocks. It makes no report for
// a script that prints JSON, because a hook that prints valid JSON succeeds whatever its exit code.
import type { Rule } from 'eslint'
import {
  BLOCKING_EVENTS,
  EXIT_CODE_TWO_NOT_THE_WAY,
  ON_FAILURE_IGNORED,
} from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  inBackground,
  stringOf,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'
import { type Command, printedBy, sinkOf, statementAt } from '../shell-words.ts'

const name = 'hooks-output-blocking-exit-code' as const

/** True when the commands write to stderr and then run `exit 1`, and print no JSON. */
function exitsOneAfterMessage(commands: Command[]): boolean {
  if (printedBy(commands).some(({ json }) => json !== undefined)) {
    return false
  }
  let wrote = false
  return commands.some(({ words }, index) => {
    wrote ||= sinkOf(commands, index) === 'stderr'
    const at = statementAt(words)
    return wrote && words[at] === 'exit' && words[at + 1] === '1'
  })
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Exit with 2, not 1, in a hook that blocks',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      exit1:
        'This {{event}} hook {{source}} writes a message to stderr and exits with 1. Claude Code treats exit 1 as a non-blocking error, so the action goes ahead. Exit with 2 to block.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, handler } of handlersOf(source)) {
        // `onFailure: "block"` makes any other exit code block, except on the events that ignore the field.
        const failureBlocks =
          stringOf(handler, 'onFailure') === 'block' && !ON_FAILURE_IGNORED.includes(event)
        if (
          !BLOCKING_EVENTS.includes(event) ||
          EXIT_CODE_TWO_NOT_THE_WAY.includes(event) ||
          failureBlocks ||
          inBackground(handler)
        ) {
          continue
        }
        const output = commandOutput(handler, folders)
        const found = output?.texts.find(({ commands }) => exitsOneAfterMessage(commands))
        if (output !== undefined && found !== undefined) {
          context.report({
            loc: output.loc,
            messageId: 'exit1',
            data: {
              event,
              source: found.script === undefined ? 'command' : `script "${found.script}"`,
            },
          })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
