// A permission rule names a tool by its canonical name, and the name is
// case-sensitive. A rule for any other name never matches a tool
// (docs/rules/permissions-unknown-tool.md).
import type { Rule } from 'eslint'
import { OTHER_RULE_TOOL_NAMES, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-unknown-tool' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a tool that Claude Code knows in a permission rule',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalTools: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ additionalTools: [] }],
    messages: {
      unknown: 'Claude Code has no tool named "{{tool}}", so this rule never matches.',
      wrongCase:
        'Claude Code has no tool named "{{tool}}", so this rule never matches. Did you mean "{{known}}"?',
    },
  },
  create(context) {
    const known = [...TOOL_NAMES, ...OTHER_RULE_TOOL_NAMES, ...context.options[0].additionalTools]
    return permissionListener(context, (entries) => {
      for (const { loc, rule: parsed } of parsedEntries(entries)) {
        const { tool } = parsed
        // The docs exempt a name with `_` or `*` from the check. This
        // covers each `mcp__` name and each glob.
        if (known.includes(tool) || tool.includes('_') || tool.includes('*')) {
          continue
        }
        const match = known.find((candidate) => candidate.toLowerCase() === tool.toLowerCase())
        if (match === undefined) {
          context.report({ loc, messageId: 'unknown', data: { tool } })
        } else {
          context.report({ loc, messageId: 'wrongCase', data: { tool, known: match } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}
