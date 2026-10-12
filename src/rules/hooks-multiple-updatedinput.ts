// When several `PreToolUse` hooks return `updatedInput`, the last one to finish takes effect, and the order
// is not fixed, because the hooks run in parallel (docs/rules/hooks-multiple-updatedinput.md). The rule reads
// the handlers of one file. It reports a handler that prints `hookSpecificOutput.updatedInput` as a literal,
// when an earlier handler of the file does so too, and a tool exists that both matchers select. A handler with an
// `if` condition, or in the background, is not a provable rewrite for every call, so the rule skips it.
import type { Rule } from 'eslint'
import { TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  exactValues,
  groupsOf,
  HOOKS_TARGET,
  hooksListener,
  inBackground,
  memberOf,
  objectField,
  printedJson,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'

const name = 'hooks-multiple-updatedinput' as const

/** True when the matcher selects every tool: it is missing, empty or `*`. */
const matchesAll = (matcher: string | undefined) =>
  matcher === undefined || matcher === '' || matcher === '*'

/** True when `matcher` selects the tool `tool`. */
function selects(matcher: string | undefined, tool: string): boolean {
  if (matchesAll(matcher)) {
    return true
  }
  const values = exactValues(matcher, false)
  if (values !== null) {
    return values.includes(tool)
  }
  try {
    return new RegExp(matcher).test(tool)
  } catch {
    return false
  }
}

/** The text that names a tool that both matchers select, or undefined. The candidates are the tools that
 *  the matchers name, and the built-in tools. */
function commonTool(first: string | undefined, second: string | undefined): string | undefined {
  const named = [first, second].flatMap((matcher) => exactValues(matcher ?? '', false) ?? [])
  const tool = [...named, ...TOOL_NAMES].find(
    (candidate) => selects(first, candidate) && selects(second, candidate),
  )
  if (tool === undefined) {
    return undefined
  }
  return matchesAll(first) && matchesAll(second) ? 'every tool' : `the tool ${tool}`
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Let one PreToolUse hook rewrite the input of a tool',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      multiple:
        'An earlier PreToolUse handler in this file also returns "updatedInput" for {{tool}}. The hooks run in parallel, and the last one to finish wins. Let one hook rewrite the input.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      const earlier: (string | undefined)[] = []
      for (const { event, group, matcher, handlers } of groupsOf(source)) {
        const given = memberOf(group, 'matcher')?.value
        // A matcher that is no string is for `hooks-config-schema`. A matcher that holds a merge key is
        // unseen, and no rule reports it.
        if (event !== 'PreToolUse' || (given !== undefined && given.kind !== 'string')) {
          continue
        }
        for (const handler of handlers) {
          const output = commandOutput(handler, folders)
          if (
            output === undefined ||
            memberOf(handler, 'if') !== undefined ||
            inBackground(handler) ||
            !printedJson(output.texts).some(
              (json) =>
                objectField(objectField(json, 'hookSpecificOutput') ?? {}, 'updatedInput') !==
                undefined,
            )
          ) {
            continue
          }
          const tools = earlier.map((other) => commonTool(other, matcher?.value))
          const tool = tools.find((found) => found !== undefined)
          if (tool !== undefined) {
            context.report({ loc: output.loc, messageId: 'multiple', data: { tool } })
          }
          earlier.push(matcher?.value)
        }
      }
    })
  },
}

export const target = { name, ...HOOKS_TARGET }

export default rule
