// A `${VAR}` reference in a policy entry (docs/rules/mcp-policy-literal-values.md). Claude Code
// expands `serverUrl` and `serverCommand` values before the match, from a pinned environment
// that still depends on the shell that launches it. An allowlist entry whose expansion changes
// the scheme, host or path scope is ignored. The docs say to use literal values for an entry that
// enforces policy. A `serverName` never expands. `managedMcpServers` is another key, and
// `mcp-managed-servers-entry` reports a reference there.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { plainOf, policyKey } from '../mcp-servers.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-policy-literal-values' as const

const LISTS = ['allowedMcpServers', 'deniedMcpServers'] as const

/** A `${VAR}` reference. */
const REFERENCE = /\$\{[^}]*\}/

const rule: JSONRuleDefinition<{ MessageIds: 'variable' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a literal serverUrl and serverCommand in an MCP policy entry',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      variable:
        'The {{key}} entry uses {{reference}}. Claude Code expands it from the environment that launches it, so the entry can match other servers than you intend, or be ignored. Write a literal value.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const list of LISTS) {
          const entries = lastMember(node.body, list)?.value
          if (entries?.type !== 'Array') {
            continue
          }
          for (const { value } of entries.elements) {
            const plain = plainOf(value) as Record<string, unknown>
            const kind = policyKey(plain)?.split(':', 1)[0]
            if (kind !== 'url' && kind !== 'command') {
              continue
            }
            const key = kind === 'url' ? 'serverUrl' : 'serverCommand'
            // Claude Code expands each item of a command alone, so a reference does not span items.
            const reference = [plain[key]]
              .flat()
              .map((text) => REFERENCE.exec(String(text))?.[0])
              .find((found) => found !== undefined)
            if (reference !== undefined) {
              context.report({ node: value, messageId: 'variable', data: { key, reference } })
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
  files: MANAGED_SETTINGS_FILES,
  rule,
}
