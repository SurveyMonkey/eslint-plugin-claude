// An MCP config under `.claude/` (docs/rules/mcp-json-location.md). Claude Code reads
// `.mcp.json` at the project root and `~/.claude.json`, and no file under `.claude/`.
// The rule reports the paths that people try. The files glob lists them, and the rule
// checks the path again, so a file elsewhere gets no report.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isUnreadMcpPath } from '../mcp-servers.ts'

const name = 'mcp-json-location' as const

const rule: JSONRuleDefinition<{ MessageIds: 'unread' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put the project MCP config in .mcp.json at the repository root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unread:
        'Claude Code does not read an MCP config under `.claude/`. Move the servers to `.mcp.json` at the repository root.',
    },
  },
  create(context) {
    if (!isUnreadMcpPath(context.filename)) {
      return {}
    }
    return {
      Document() {
        // The JSON language counts columns from 1.
        context.report({
          loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
          messageId: 'unread',
        })
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/.mcp.json', '**/.claude/mcp.json', '**/.claude/config/mcp.json'],
  rule,
}
