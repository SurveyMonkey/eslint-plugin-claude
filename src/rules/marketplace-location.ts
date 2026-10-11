// Claude Code finds a marketplace at `.claude-plugin/marketplace.json` in the
// marketplace root. The rule reads the path of the linted file and the shape
// of its text. It reads no other file (docs/rules/marketplace-location.md).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'

const name = 'marketplace-location' as const

const rule: JSONRuleDefinition<{ MessageIds: 'misplaced' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep marketplace.json in the .claude-plugin directory',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      misplaced:
        'This marketplace file is not in a ".claude-plugin" directory. "claude plugin marketplace add" cannot find it. Users must declare it in "extraKnownMarketplaces" with "path" set on its source.',
    },
  },
  create(context) {
    return {
      Document(node) {
        // A file with no `plugins` array is not known to be a marketplace.
        if (
          lastMember(node.body, 'plugins')?.value.type === 'Array' &&
          path.basename(path.dirname(context.filename)) !== '.claude-plugin'
        ) {
          context.report({ node: node.body, messageId: 'misplaced' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/marketplace.json'],
  rule,
}
