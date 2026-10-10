// A name in `enabledMcpjsonServers` or `disabledMcpjsonServers` is a server of the project
// `.mcp.json` (docs/rules/mcp-approval-names-exist.md). The settings reference gives the lists as
// "the server names as they appear in `.mcp.json`". A name that is not a key of `mcpServers`
// matches no server. The rule reads `.mcp.json` beside the `.claude/` folder of the settings
// file, and no other server file. It makes no report when the file is not there, cannot be read,
// or has no `mcpServers` object. `mcp-json-servers-key` reports that last case (ADR 001,
// Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readJsonBody, serverMembers } from '../mcp-servers.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'mcp-approval-names-exist' as const

const LISTS = ['enabledMcpjsonServers', 'disabledMcpjsonServers']

const rule: JSONRuleDefinition<{ MessageIds: 'unknown' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name only servers of .mcp.json in the project server approval lists',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        'The server "{{server}}" in "{{list}}" is not a server of .mcp.json. Claude Code matches these names with the keys of "mcpServers", so this entry matches no server. Fix the name, or remove the entry.',
    },
  },
  create(context) {
    // The project is the directory that holds the `.claude/` folder.
    const project = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const entries = LISTS.flatMap((list) => {
          const value = lastMember(node.body, list)?.value
          return value?.type === 'Array'
            ? value.elements.flatMap(({ value: item }) =>
                item.type === 'String' ? [{ list, item }] : [],
              )
            : []
        })
        if (entries.length === 0) {
          return
        }
        const file = readJsonBody(path.join(project, '.mcp.json'), repositoryRoot(project))
        // A file with no `mcpServers` object is for `mcp-json-servers-key`.
        if (file === null || lastMember(file, 'mcpServers')?.value.type !== 'Object') {
          return
        }
        const declared = new Set(serverMembers(file, 'project').map(({ name: key }) => keyOf(key)))
        for (const { list, item } of entries) {
          if (!declared.has(item.value)) {
            context.report({ node: item, messageId: 'unknown', data: { server: item.value, list } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
