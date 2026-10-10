// An MCP bundle in the `mcpServers` of a plugin under `.claude/skills/`
// (docs/rules/mcp-project-plugin-bundle.md). A plugin in the skills directory of a project is
// checked into the repository. Claude Code skips each MCP server that such a plugin declares as an
// MCP bundle, a `.mcpb` or `.dxt` file. The rule reads the manifest text only and reads no file.
// The rule does not check that a path stays in the plugin directory. A path with `..` fails
// `claude plugin validate`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { declaredMcpStrings } from '../mcp-servers.ts'

const name = 'mcp-project-plugin-bundle' as const

const BUNDLE_EXTENSIONS = ['.mcpb', '.dxt']

/** The path part of a bundle URL, or `declared` itself when it is not a URL. A query or a
 *  fragment does not count as part of the file name. */
function pathOf(declared: string): string {
  try {
    return new URL(declared).pathname
  } catch {
    return declared
  }
}

const rule: JSONRuleDefinition<{ MessageIds: 'skipped' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Declare the MCP servers of a project plugin inline or in a .mcp.json',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skipped:
        'Claude Code skips the MCP bundle "{{bundle}}" in a plugin under .claude/skills/. Declare the server inline, or in a .mcp.json inside the plugin directory.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const declared of declaredMcpStrings(node.body)) {
          if (BUNDLE_EXTENSIONS.some((extension) => pathOf(declared.value).endsWith(extension))) {
            context.report({
              node: declared,
              messageId: 'skipped',
              data: { bundle: declared.value },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/skills/*/.claude-plugin/plugin.json'],
  rule,
}
