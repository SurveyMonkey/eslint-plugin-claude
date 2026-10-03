// A tool that takes no specifier accepts its bare name only. A deny or ask
// rule can still match a parameter with `Tool(param:value)`
// (docs/rules/permissions-specifier-unsupported.md).
import type { Rule } from 'eslint'
import { SPECIFIER_TOOLS, TOOL_NAMES } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parameterOf, parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-specifier-unsupported' as const

const SPECIFIER_SET = new Set(SPECIFIER_TOOLS)
const BARE_ONLY = new Set(TOOL_NAMES.filter((tool) => !SPECIFIER_SET.has(tool)))

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a tool that takes no specifier as its bare name',
      url: docsUrl(name),
    },
    messages: {
      unsupported:
        '{{tool}} takes the bare tool name only, so this rule does not match as written.',
    },
  },
  create(context) {
    return permissionListener(context, (entries) => {
      for (const entry of parsedEntries(entries)) {
        const { tool, specifier } = entry.rule
        if (BARE_ONLY.has(tool) && specifier !== null && parameterOf(entry) === null) {
          context.report({ loc: entry.loc, messageId: 'unsupported', data: { tool } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}
