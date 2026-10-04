// `Skill(anthropic *)` in an allow list does not cover the synced skills of
// the `anthropic-skills` namespace (docs/rules/permissions-skill-rule.md).
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'

const name = 'permissions-skill-rule' as const

/** The namespace that Claude Code reserves for skills synced from claude.ai. */
const NAMESPACE = 'anthropic-skills'

/** The vendor name that starts the namespace. A shorter prefix, such as `a`,
 *  is a common start for the name of a local skill. */
const VENDOR = 'anthropic'

/** The prefix of a `Skill(prefix *)` rule that stops short of the namespace but
 *  starts with the vendor name, or null. */
function shortPrefix(specifier: string): string | null {
  if (!specifier.endsWith(' *')) {
    return null
  }
  const prefix = specifier.slice(0, -2)
  return prefix.startsWith(VENDOR) && NAMESPACE.startsWith(prefix) && prefix !== NAMESPACE
    ? prefix
    : null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name the anthropic-skills namespace in a Skill allow rule for a synced skill',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      outsideNamespace:
        '`Skill({{prefix}} *)` does not cover the skills in the "anthropic-skills" namespace, because a prefix outside the namespace does not match the names inside it. Use `Skill(anthropic-skills *)`.',
    },
  },
  create(context) {
    return permissionListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of parsedEntries(entries)) {
        const prefix =
          list === 'allow' && parsed.tool === 'Skill' && parsed.specifier !== null
            ? shortPrefix(parsed.specifier)
            : null
        if (prefix !== null) {
          context.report({ loc, messageId: 'outsideNamespace', data: { prefix } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}
