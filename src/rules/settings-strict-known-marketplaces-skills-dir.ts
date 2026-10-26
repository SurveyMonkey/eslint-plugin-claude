// A `strictKnownMarketplaces` list needs `{ "source": "skills-dir" }`, or skills-directory plugins
// do not load (docs/rules/settings-strict-known-marketplaces-skills-dir.md). The managed settings
// page merges `managed-settings.json` and each `managed-settings.d/*.json` drop-in into one source,
// and combines the lists. A file can lock a kind of customization with
// `strictPluginOnlyCustomization`. Such a lock stops the plugins whether or not the entry is there,
// so the rule makes no report. The rule reads the text of the linted file, and the sibling files through
// `readManagedSource`.
import type { JSONRuleDefinition } from '@eslint/json'
import { UNLOADED_MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf } from '../marketplace-json.ts'
import { marketplaceMember } from '../marketplace-settings.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readManagedSource } from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-strict-known-marketplaces-skills-dir' as const

type Fields = Record<string, unknown>

/** True when `fields` lists the `skills-dir` source in `strictKnownMarketplaces` (or its alias) or in
 *  `blockedMarketplaces`. In the blocklist the entry stops skills-directory plugins on purpose
 *  (plugins/org, "Blocklist with `blockedMarketplaces`"). */
function listsSkillsDir(fields: Fields): boolean {
  // The rule counts the canonical key as set with any value, as the conflict rule does.
  const allowed = Object.hasOwn(fields, 'strictKnownMarketplaces')
    ? fields.strictKnownMarketplaces
    : fields.allowedMarketplaces
  return [allowed, fields.blockedMarketplaces].some(
    (list) =>
      Array.isArray(list) &&
      list.some(
        (entry: unknown) =>
          typeof entry === 'object' &&
          entry !== null &&
          (entry as Fields).source === UNLOADED_MARKETPLACE_SOURCE_TYPES.skillsDir,
      ),
  )
}

/** The kinds of customization that `strictPluginOnlyCustomization` locks (settings reference,
 *  `strictPluginOnlyCustomization`). */
const LOCKABLE_KINDS: readonly unknown[] = ['skills', 'agents', 'hooks', 'mcp']

/** True when `fields` locks a kind of customization. Claude Code then skips skills-directory
 *  plugins, with or without the entry. An array locks the kinds that it names, and an entry that is
 *  not a kind locks nothing. A value that is not a Boolean, an array or `null` reads as `true`
 *  (managed settings, "Keys that fail closed"), a quoted `"false"` too. */
function locksCustomization(fields: Fields): boolean {
  const lock = fields.strictPluginOnlyCustomization
  if (Array.isArray(lock)) {
    return lock.some((entry: unknown) => LOCKABLE_KINDS.includes(entry))
  }
  if (typeof lock === 'boolean') {
    return lock
  }
  // A `null` removes the key.
  return lock !== undefined && lock !== null
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'missing' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add the skills-dir source to a strictKnownMarketplaces allowlist',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'Claude Code does not load skills-directory plugins when an allowlist has no entry for them. This "{{key}}" list has no {"source": "skills-dir"} entry. Add it to keep the plugins that users keep under ".claude/skills/".',
    },
  },
  create(context) {
    return {
      Document(node) {
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const member = marketplaceMember(node.body, 'strictKnownMarketplaces')
        if (member?.value.type !== 'Array') {
          return
        }
        // The top level has the key, so it is an object. The rule cannot see text that `JSON.parse`
        // rejects, such as a comment in a JSONC file.
        let own: Fields
        try {
          own = JSON.parse(context.sourceCode.text) as Fields
        } catch {
          return
        }
        const siblings = readManagedSource(context.filename)
        // A part that the rule cannot see can hold the entry, or set "merge".
        if (siblings === UNREADABLE) {
          return
        }
        const source = [own, ...siblings]
        // The rule cannot tell which sources "merge" joins to this one. The repository does not
        // hold them.
        if (source.some((fields) => fields.managedSourcesBehavior === 'merge')) {
          return
        }
        // The entry does not help when a lock is set, so a report would ask for no gain.
        if (!source.some(listsSkillsDir) && !source.some(locksCustomization)) {
          context.report({
            node: member.name,
            messageId: 'missing',
            data: { key: keyOf(member.name) },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: MANAGED_SETTINGS_FILES,
}

export default rule
