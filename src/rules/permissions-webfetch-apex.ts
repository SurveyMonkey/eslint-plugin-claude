// `WebFetch(domain:*.example.com)` matches any subdomain at any depth, but not `example.com`
// itself (docs/rules/permissions-webfetch-apex.md). The rule rests on an absence, so it adds up
// each list over one source, and makes no report when it cannot read a file of the source.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { fetchHost, isPlainHost } from '../permission-host.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { isDeadAllow, listRules, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-webfetch-apex' as const

/** The apex of a wildcard host: the text after the leading `*.`. It is null when the host does not
 *  start with `*.`, is empty after it, holds another `*`, is not a plain host, or holds a path,
 *  query, fragment or empty label. */
function apexOf(host: string | null): string | null {
  const apex = host?.startsWith('*.') ? host.slice(2) : ''
  return apex === '' ||
    apex.includes('*') ||
    !isPlainHost(apex) ||
    /[/?#]/.test(apex) ||
    apex.split('.').includes('')
    ? null
    : apex
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'apex' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add a WebFetch rule for the apex domain next to a wildcard subdomain rule',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      apex: '`WebFetch(domain:*.{{apex}})` does not match `{{apex}}` itself. The {{list}} list has no rule for it. Add `WebFetch(domain:{{apex}})` to cover the apex domain.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const wild = entries.flatMap((entry) => {
        const { tool, specifier } = entry.rule
        const apex = tool === 'WebFetch' ? apexOf(fetchHost(specifier)) : null
        return apex === null ? [] : [{ ...entry, apex }]
      })
      if (wild.length === 0) {
        return
      }
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      if (!complete) {
        return
      }
      for (const { list, loc, rule: parsed, apex } of wild) {
        const covered = listRules(objects, list).some(
          ({ tool, specifier }) =>
            tool === 'WebFetch' &&
            (specifier === null || ['*', apex].includes(fetchHost(specifier) ?? '')),
        )
        if (!covered && !(list === 'allow' && isDeadAllow(objects, parsed))) {
          context.report({ loc, messageId: 'apex', data: { apex, list } })
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
