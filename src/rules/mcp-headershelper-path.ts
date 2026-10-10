// A `headersHelper` that names a relative path (docs/rules/mcp-headershelper-path.md). Claude Code
// runs the helper in a directory that depends on where the server is configured: the plugin root
// for a plugin, the project directory for a project `.mcp.json`. The docs say to give the script
// as an absolute path or to put it on `PATH`. The rule reads the first word of the command, after
// any `NAME=value` words. It reports a word with a `/` that does not start with `/`, `$` or `~`.
// Claude Code or the shell expands a `$` or `~` start to a path that does not depend on the
// directory. The rule reads a `.mcp.json` and the servers that a plugin manifest declares.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { lintedServers } from '../mcp-servers.ts'

const name = 'mcp-headershelper-path' as const

/** The first word of the shell command `command`, with a quote at each end removed. A word
 *  `NAME=value` before it sets a variable for the command, so the rule skips it. */
const firstWord = (command: string) =>
  command
    .trim()
    .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '')
    .replace(/\s.*$/s, '')
    .replace(/^["']|["']$/g, '')

/** True when the word `word` is a path that depends on the working directory. */
const isRelative = (word: string) => word.includes('/') && !/^[/$~]/.test(word)

const rule: JSONRuleDefinition<{ MessageIds: 'relative' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give an MCP headersHelper an absolute path or a command on PATH',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relative:
        'The `headersHelper` of the server "{{server}}" starts with the relative path "{{path}}". Claude Code runs it in a directory that depends on where the server is configured. Use an absolute path, or a command on `PATH`.',
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const helper = lastMember(server.member.value, 'headersHelper')?.value
          if (helper?.type !== 'String') {
            continue
          }
          const word = firstWord(helper.value)
          if (isRelative(word)) {
            context.report({
              node: server.pinned ?? helper,
              messageId: 'relative',
              data: { server: server.name, path: word },
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
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}
