// An MCP tool is named `mcp__<server>__<tool>`. A matcher with exact-match characters only is an
// exact string, so a bare server name matches no tool (docs/rules/hooks-matcher-mcp-name.md).
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import { MCP_PREFIX, MCP_SEPARATOR } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { exactValues, groupsOf, HOOKS_TARGET, hooksListener } from '../hooks-config.ts'

const name = 'hooks-matcher-mcp-name' as const

/** True when `segment` is `mcp__<server>` or `mcp__<server>__`, so it names no tool. */
function isBareServer(segment: string): boolean {
  if (!segment.startsWith(MCP_PREFIX)) {
    return false
  }
  const rest = segment.slice(MCP_PREFIX.length)
  const split = rest.indexOf(MCP_SEPARATOR)
  return split === -1 || split + MCP_SEPARATOR.length === rest.length
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Match the tools of an MCP server with mcp__<server>__.*, not the server name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      bare: 'The matcher "{{segment}}" names an MCP server and no tool, so it matches no tool. Write "{{fix}}".',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, matcher } of groupsOf(source)) {
        if (matcher === undefined || !TOOL_EVENTS.includes(event)) {
          continue
        }
        // A matcher with another character is a regular expression, and `mcp__x__.*` is one.
        for (const segment of exactValues(matcher.value, false) ?? []) {
          if (isBareServer(segment)) {
            const fix = `${segment}${segment.endsWith(MCP_SEPARATOR) ? '' : MCP_SEPARATOR}.*`
            context.report({ loc: matcher.loc, messageId: 'bare', data: { segment, fix } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
