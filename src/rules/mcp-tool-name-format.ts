// A tool reference that starts with `mcp` and is not in the `mcp__<server>` form
// (docs/rules/mcp-tool-name-format.md). An MCP tool is `mcp__<server>__<tool>`, and a rule can name
// the server alone as `mcp__<server>`. A name such as `mcp_server_tool` is not one of these forms.
// `permissions-unknown-tool` reports a name that has no `_` and no `*`, such as `mcp-server`.
// `permissions-tool-name-glob` reports a glob in an allow rule. So this rule skips a name with a
// `*` when the name does not start with `mcp__`. It reports `mcp____*`, which has no server name.
import type { Rule } from 'eslint'
import { MCP_PREFIX, MCP_SEPARATOR } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-tool-name-format' as const

/** True when the tool name `tool` is an MCP reference that this rule reports. */
function isFault(tool: string): boolean {
  if (!tool.startsWith('mcp')) {
    return false
  }
  if (!tool.startsWith(MCP_PREFIX)) {
    return tool.includes('_') && !tool.includes('*')
  }
  // `mcp__` and `mcp____<tool>` have no server name.
  const rest = tool.slice(MCP_PREFIX.length)
  return rest === '' || rest.startsWith(MCP_SEPARATOR)
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write an MCP tool reference as mcp__<server> or mcp__<server>__<tool>',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      format:
        'The tool name "{{tool}}" is not an MCP tool form. Use "mcp__<server>" or "mcp__<server>__<tool>".',
    },
  },
  create(context) {
    return permissionListener(context, (entries) => {
      for (const { loc, rule: parsed } of parsedEntries(entries)) {
        if (isFault(parsed.tool)) {
          context.report({ loc, messageId: 'format', data: { tool: parsed.tool } })
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
