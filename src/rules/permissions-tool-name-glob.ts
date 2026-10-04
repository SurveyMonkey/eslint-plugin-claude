// An allow rule takes a glob in the tool name only after a literal
// `mcp__<server>__` prefix. Claude Code skips any other glob in an allow rule
// (docs/rules/permissions-tool-name-glob.md).
import type { Rule } from 'eslint'
import { MCP_PREFIX, MCP_SEPARATOR } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-tool-name-glob' as const

/** True when `tool` starts with `mcp__<server>__` and the server has no glob. */
function anchoredToServer(tool: string): boolean {
  if (!tool.startsWith(MCP_PREFIX)) {
    return false
  }
  const separator = tool.indexOf(MCP_SEPARATOR, MCP_PREFIX.length + 1)
  return separator !== -1 && !tool.slice(0, separator).includes('*')
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put a tool-name glob in an allow rule only after mcp__<server>__',
      url: docsUrl(name),
    },
    messages: {
      unanchored:
        'An allow rule takes a tool-name glob only after a literal "mcp__<server>__" prefix. Claude Code skips this rule.',
    },
  },
  create(context) {
    return permissionListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of parsedEntries(entries)) {
        if (list === 'allow' && parsed.tool.includes('*') && !anchoredToServer(parsed.tool)) {
          context.report({ loc, messageId: 'unanchored' })
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
