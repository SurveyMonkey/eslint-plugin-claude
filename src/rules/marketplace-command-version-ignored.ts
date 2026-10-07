// Claude Code derives the version of a `command` source from the output of the
// command. It ignores the `version` of the entry
// (docs/rules/marketplace-command-version-ignored.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-command-version-ignored' as const

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set the version of an entry with a command source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'The entry has a command source, so Claude Code ignores its "version". Claude Code derives the version from the command output.',
    },
  },
  create() {
    return {}
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
