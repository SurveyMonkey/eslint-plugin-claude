// An allow rule for the whole of `Bash` or `PowerShell` matches every command.
// `WebFetch(domain:*)` matches every fetch, and it also lets sandboxed
// commands reach any host (docs/rules/permissions-allow-unrestricted.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-allow-unrestricted' as const

type MessageId = 'command' | 'fetch'

/** The shell tools whose bare name and `(*)` form match every command. The
 *  permissions page says so for `Bash` ("Match all uses of a tool") and for
 *  `PowerShell` ("PowerShell"). */
const SHELL_TOOLS = ['Bash', 'PowerShell']

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not allow every Bash or PowerShell command, or every WebFetch domain',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      command:
        '`{{rule}}` matches every {{tool}} command, so Claude Code runs each one without manual approval. Allow the commands that you need, such as `{{tool}}(npm test)`.',
      fetch:
        '`{{rule}}` matches every fetch, so Claude fetches without a prompt, and sandboxed commands can reach any host. Allow the domains that you need.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (list !== 'allow') {
          continue
        }
        const { tool, specifier } = parsed
        const text = specifier === null ? tool : `${tool}(${specifier})`
        if (SHELL_TOOLS.includes(tool) && (specifier === null || specifier === '*')) {
          context.report({ loc, messageId: 'command', data: { rule: text, tool } })
        } else if (tool === 'WebFetch' && specifier === 'domain:*') {
          context.report({ loc, messageId: 'fetch', data: { rule: text } })
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
