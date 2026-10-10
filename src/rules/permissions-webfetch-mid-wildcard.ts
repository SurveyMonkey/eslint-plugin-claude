// The sandbox honors two wildcard forms in a `WebFetch(domain:...)` rule: a leading `*.` and a
// bare `*`. A wildcard in any other position still matches fetches and has no effect on
// sandboxed commands (docs/rules/permissions-webfetch-mid-wildcard.md). The rule reads
// `sandbox.enabled` in the file that it lints, and in no other file.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { fetchHost } from '../permission-host.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { valueAt } from '../permission-sandbox.ts'
import { isDeadAllow, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-webfetch-mid-wildcard' as const

/** True when `host` has a `*` that the sandbox does not honor: any `*` after a leading `*.`, and
 *  any `*` in a host that does not start with `*.` unless the host is `*`. */
function hasInertWildcard(host: string): boolean {
  return host !== '*' && (host.startsWith('*.') ? host.slice(2) : host).includes('*')
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'inert' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use only a leading *. or a bare * in a WebFetch domain while the sandbox is on',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      inert:
        '`{{rule}}` still matches fetches, but the sandbox ignores it for the domains of sandboxed commands, because the `*` is not a leading `*.` or a bare `*`. Write the domain in full, or as `*.example.com`.',
    },
  },
  create(context) {
    return settingsListener(context, (entries, document) => {
      const enabled = valueAt(document, ['sandbox', 'enabled'])
      if (enabled?.type !== 'Boolean' || !enabled.value) {
        return
      }
      const found = entries.filter(({ list, rule: { tool, specifier } }) => {
        const host = tool === 'WebFetch' ? fetchHost(specifier) : null
        return list !== 'ask' && host !== null && hasInertWildcard(host)
      })
      if (found.length === 0) {
        return
      }
      const { objects } = sourceOf(context.filename, context.sourceCode.text)
      for (const { list, loc, rule: parsed } of found) {
        // `permissions-dead-allow` reports an allow rule that a deny or ask rule covers.
        if (!(list === 'allow' && isDeadAllow(objects, parsed))) {
          context.report({
            loc,
            messageId: 'inert',
            data: { rule: `WebFetch(${parsed.specifier})` },
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
