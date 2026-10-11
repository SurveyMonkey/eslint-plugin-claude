// Claude Code caps `additionalContext`, `systemMessage`, `initialUserMessage` and plain stdout at 10,000 characters,
// and the `classifierContext` notes of one tool call at 2,000 characters (docs/rules/hooks-output-size.md).
// Over the first cap, Claude Code saves the text to a file and passes Claude the path and a preview. No setting
// raises either cap. The rule measures the strings that a command prints as literals, inline or from a
// repository script. The options set a lower limit, and their schemas allow no more than the cap. At another
// value, the message names the configured limit.
import type { Rule } from 'eslint'
import { PLAIN_STDOUT_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  type Json,
  objectField,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'
import { printedBy } from '../shell-words.ts'

const name = 'hooks-output-size' as const

const OUTPUT_CAP = 10_000
const CLASSIFIER_CAP = 2_000

type Options = [{ maxOutputChars: number; maxClassifierChars: number }]

/** The context fields that the output cap measures. */
const CONTEXT_FIELDS = ['additionalContext', 'systemMessage', 'initialUserMessage']

/** A string of a field, with the text that names it in a message. */
interface Measured {
  what: string
  length: number
  classifier: boolean
}

/** The strings that the caps measure in the JSON object `json`. A field is read at the top level and inside
 *  `hookSpecificOutput`. */
function measuredIn(json: Json): Measured[] {
  const holders = [json, objectField(json, 'hookSpecificOutput')]
  return [...CONTEXT_FIELDS, 'classifierContext'].flatMap((field) =>
    holders.flatMap((holder) => {
      const value = holder?.[field]
      return typeof value === 'string'
        ? [
            {
              what: `"${field}" string`,
              length: value.length,
              classifier: field === 'classifierContext',
            },
          ]
        : []
    }),
  )
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep the context that a hook prints under the output caps',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxOutputChars: { type: 'integer', minimum: 1, maximum: OUTPUT_CAP },
          maxClassifierChars: { type: 'integer', minimum: 1, maximum: CLASSIFIER_CAP },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxOutputChars: OUTPUT_CAP, maxClassifierChars: CLASSIFIER_CAP }],
    messages: {
      overCap:
        'The {{what}} has {{length}} characters. Claude Code caps it at {{max}}, saves the text to a file, and passes Claude the file path with a preview of the first 2,000 characters.',
      overConfigured: 'The {{what}} has {{length}} characters. The configured limit is {{max}}.',
      classifierCap:
        'The {{what}} has {{length}} characters. Claude Code caps the notes of one tool call at {{max}} characters and cuts the rest.',
    },
  },
  create(context) {
    const [{ maxOutputChars, maxClassifierChars }] = context.options as Options
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, handler } of handlersOf(source)) {
        const output = commandOutput(handler, folders)
        if (output === undefined) {
          continue
        }
        const printed = output.texts.flatMap(({ commands }) => printedBy(commands))
        const strings = printed.flatMap(({ json, text }): Measured[] =>
          json !== undefined
            ? measuredIn(json)
            : PLAIN_STDOUT_EVENTS.includes(event)
              ? [{ what: 'plain stdout', length: text.length, classifier: false }]
              : [],
        )
        const seen = new Set<string>()
        for (const { what, length, classifier } of strings) {
          const max = classifier ? maxClassifierChars : maxOutputChars
          const cap = classifier ? CLASSIFIER_CAP : OUTPUT_CAP
          if (length > max && !seen.has(what)) {
            seen.add(what)
            context.report({
              loc: output.loc,
              // At another value, the message names the configured limit and claims no cut.
              messageId: max !== cap ? 'overConfigured' : classifier ? 'classifierCap' : 'overCap',
              data: { what, length: String(length), max: String(max) },
            })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
