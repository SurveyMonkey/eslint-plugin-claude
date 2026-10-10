// Two LSP servers that claim one file extension (docs/rules/lsp-extension-conflict.md). Claude
// Code uses the first registered server for those files, and not the other, whether the servers
// come from one plugin or two. The rule lints `marketplace.json`. It reads the plugin of each
// entry that has a relative source, through `sourceReader`, and then `.lsp.json`, the declared
// `.json` files and the inline maps of the plugin through `pluginLspDeclarations`. A plugin that
// the rule cannot read adds no claim (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { claimedExtensions, pluginLspDeclarations } from '../lsp-servers.ts'
import { lastMember, type MemberNode, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'
import { type Declaration, readJsonBody } from '../mcp-servers.ts'
import { repositoryRoot } from '../skill-tree.ts'

const name = 'lsp-extension-conflict' as const

/** The first server that claims an extension, with the plugin that declares it. */
interface Claim {
  readonly server: string
  readonly plugin: string
}

const rule: JSONRuleDefinition<{ MessageIds: 'conflict' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not let two LSP servers of a marketplace claim one file extension',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      conflict:
        'The LSP servers "{{other}}" of {{otherPlugin}} and "{{server}}" of {{plugin}} both claim the extension "{{ext}}". Claude Code uses the first registered server for those files, and not the other. Give each server its own extensions.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        const claims = new Map<string, Claim>()
        const seen = new Set<string>()
        for (const entry of pluginEntries(node)) {
          const source = read(entry)
          if (
            (source.kind !== 'manifest' && source.kind !== 'no-manifest') ||
            seen.has(source.dir)
          ) {
            continue
          }
          seen.add(source.dir)
          // A relative source is a string, so the member is there.
          const at = (lastMember(entry, 'source') as MemberNode).value
          const label = lastMember(entry, 'name')?.value
          const plugin = `plugin "${label?.type === 'String' ? label.value : path.basename(source.dir)}"`
          const manifest =
            source.kind === 'manifest'
              ? readJsonBody(
                  path.join(source.dir, '.claude-plugin', 'plugin.json'),
                  repositoryRoot(source.dir),
                )
              : null
          // A later server of one name replaces an earlier one, so only the last counts.
          const servers = new Map(
            pluginLspDeclarations(source.dir, manifest).map((d): [string, Declaration] => [
              d.name,
              d,
            ]),
          )
          const reported = new Set<string>()
          for (const [server, { member }] of servers) {
            for (const ext of claimedExtensions(member.value)) {
              const first = claims.get(ext)
              if (first === undefined) {
                claims.set(ext, { server, plugin })
              } else if (!reported.has(ext)) {
                reported.add(ext)
                context.report({
                  node: at,
                  messageId: 'conflict',
                  data: {
                    ext,
                    server,
                    plugin,
                    other: first.server,
                    otherPlugin: first.plugin,
                  },
                })
              }
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
