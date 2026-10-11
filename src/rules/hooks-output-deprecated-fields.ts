// The hooks reference marks three things as old (docs/rules/hooks-output-deprecated-fields.md):
// - the top-level `decision` and `reason` of `PreToolUse`, which `hookSpecificOutput.permissionDecision` replaces;
// - `updatedMCPToolOutput` of `PostToolUse`, where the docs say to prefer `updatedToolOutput`;
// - the input field `team_name` of the task and teammate events.
// The rule reads JSON that a command prints as a literal, and the text of the inline command and of the repository
// scripts that it runs.
import type { Rule } from 'eslint'
import { TEAM_NAME_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  commandOutput,
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  objectField,
  printedJson,
} from '../hooks-config.ts'
import { placeholderFolders } from '../hooks-files.ts'

const name = 'hooks-output-deprecated-fields' as const

type MessageId = 'preToolUseDecision' | 'updatedMcpToolOutput' | 'teamName'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not use the deprecated hook output and input fields',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      preToolUseDecision:
        'PreToolUse deprecated the top-level "decision" and "reason". Use "hookSpecificOutput.permissionDecision" and "permissionDecisionReason". The old "approve" and "block" map to "allow" and "deny".',
      updatedMcpToolOutput:
        'The hooks reference says to prefer "updatedToolOutput" over "updatedMCPToolOutput". "updatedToolOutput" works for all tools.',
      teamName:
        'The input field "team_name" is deprecated, and Claude Code will remove it in a future release. Do not read it.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const folders = placeholderFolders(context.filename, source.kind)
      for (const { event, handler } of handlersOf(source)) {
        const output = commandOutput(handler, folders)
        if (output === undefined) {
          continue
        }
        const found: MessageId[] = []
        for (const json of printedJson(output.texts)) {
          if (event === 'PreToolUse' && ('decision' in json || 'reason' in json)) {
            found.push('preToolUseDecision')
          }
          if (
            event === 'PostToolUse' &&
            ('updatedMCPToolOutput' in json ||
              'updatedMCPToolOutput' in (objectField(json, 'hookSpecificOutput') ?? {}))
          ) {
            found.push('updatedMcpToolOutput')
          }
        }
        if (
          TEAM_NAME_EVENTS.includes(event) &&
          output.texts.some(({ text }) => /\bteam_name\b/.test(text))
        ) {
          found.push('teamName')
        }
        for (const messageId of new Set(found)) {
          context.report({ loc: output.loc, messageId })
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
