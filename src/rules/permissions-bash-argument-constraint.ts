// A Bash rule that names a URL is fragile: it misses an option before the URL, another protocol, a
// redirect and a variable. The docs advise a deny rule for the fetch tools and a WebFetch rule
// (docs/rules/permissions-bash-argument-constraint.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { FETCH_COMMANDS } from '../data/bash-commands.ts'
import { COMMAND_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-argument-constraint' as const

/** The host of the first URL in `words`, `''` when the URL has no host, and undefined when no word
 *  is a URL. */
function urlHost(words: readonly string[]): string | undefined {
  const url = words.find((word) => word.includes('://'))
  return url === undefined ? undefined : (/:\/\/([^/:?#*]+)/.exec(url)?.[1] ?? '')
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'argument' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not limit curl or wget to a URL with a Bash allow rule',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      argument:
        '`{{rule}}` is fragile: it does not match an option before the URL, another protocol, a redirect or a variable. Deny `{{tool}}({{program}} *)`, and allow `WebFetch(domain:{{host}})`. Pair the deny rule with the sandbox network allowlist when the limit must hold.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (list !== 'allow' || parsed.specifier === null) {
          continue
        }
        const words = commandWords(parsed.specifier)
        const program = words[0]
        const host = urlHost(words)
        if (
          COMMAND_RULE_TOOLS.includes(parsed.tool) &&
          program !== undefined &&
          FETCH_COMMANDS.includes(program) &&
          host !== undefined
        ) {
          context.report({
            loc,
            messageId: 'argument',
            data: {
              rule: `${parsed.tool}(${parsed.specifier})`,
              tool: parsed.tool,
              program,
              host: host === '' ? '<host>' : host,
            },
          })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
