// Claude Code overrides a `Stop` hook after it blocks eight times in a row. The hooks guide says that a hook which blocks
// must read `stop_hook_active` from its input and exit early when it is `true`, and the hooks reference
// says to "check this value or process the transcript" (docs/rules/hooks-stop-loop-guard.md). The rule is a
// heuristic. A `Stop` or `SubagentStop` handler blocks when its text exits 2, or prints a block decision or
// `additionalContext`, which continue the conversation under the same loop protections. It has a guard when the
// text of the command or of a script it runs names `stop_hook_active` or `transcript_path`.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  inBackground,
  type Json,
  objectField,
  printedJson,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'
import { commandWordAt } from '../shell-words.ts'

const name = 'hooks-stop-loop-guard' as const

const EVENTS = ['Stop', 'SubagentStop']
const GUARD = /\b(?:stop_hook_active|transcript_path)\b/

/** True when the JSON output continues the conversation: a block decision, or `additionalContext` in
 *  `hookSpecificOutput`. */
const continues = (json: Json) =>
  json.decision === 'block' ||
  typeof objectField(json, 'hookSpecificOutput')?.additionalContext === 'string'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Read stop_hook_active in a Stop hook that blocks',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noGuard:
        'This {{event}} hook blocks, and nothing in it reads "stop_hook_active". Claude Code overrides a Stop hook after 8 blocks in a row. Read "stop_hook_active" from the input and exit 0 when it is true.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, handler } of handlersOf(source)) {
        if (!EVENTS.includes(event) || inBackground(handler)) {
          continue
        }
        const output = commandOutput(handler, folders)
        if (output === undefined || output.texts.some(({ text }) => GUARD.test(text))) {
          continue
        }
        const exits = output.texts.some(({ commands }) =>
          commands.some(({ words }) => {
            const at = commandWordAt(words)
            return words[at] === 'exit' && words[at + 1] === '2'
          }),
        )
        if (exits || printedJson(output.texts).some(continues)) {
          context.report({ loc: output.loc, messageId: 'noGuard', data: { event } })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
