// A bare `Bash` ask rule, or `Bash(*)`, is skipped for a command that runs in the sandbox while
// `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is true
// (https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing). The
// default of `autoAllowBashIfSandboxed` is `false` from v2.1.324, and was `true` before
// (https://code.claude.com/docs/en/settings-reference#sandbox-autoallowbashifsandboxed). So the
// rule needs a file that sets it to `true`, unless `minVersion` is older than 2.1.324. The rule
// adds up the project pair, or one managed source. The rule makes no report when it cannot read
// a file of the source, because that file can set `autoAllowBashIfSandboxed` to `false`. It does
// not read plan mode, an excluded command or `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`
// (docs/rules/permissions-sandbox-bash-ask.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { at, boolOf, sandboxOn, sourceOf } from '../permission-source.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-sandbox-bash-ask' as const

// The first version with `false` as the default of `autoAllowBashIfSandboxed`.
const FIXED = '2.1.324'

// The first version that reads each managed `sandbox` field on its own. Before it, an invalid
// field drops every managed `sandbox` field except `credentials`
// (https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox).
const PER_FIELD = '2.1.283'

type Options = [{ minVersion?: string }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'skipped' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not rely on a bare Bash ask rule while the sandbox auto-allows Bash',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      skipped:
        '`{{rule}}` is skipped for a command that runs in the sandbox, because `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is on. Claude Code before v2.1.324 turns `autoAllowBashIfSandboxed` on by default. Set `autoAllowBashIfSandboxed` to false, or scope the rule, as `Bash(git push *)`.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    // Before v2.1.324 an unset key is on. From v2.1.324 it is off, so a file must set it to `true`.
    const defaultsOn = supportsBefore(minVersion, FIXED)
    return settingsListener(context, (entries) => {
      const asks = entries.filter(
        ({ list, rule: { tool, specifier } }) =>
          list === 'ask' && tool === 'Bash' && (specifier === null || specifier.trim() === '*'),
      )
      if (asks.length === 0) {
        return
      }
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      if (!complete) {
        return
      }
      // In a managed file, Claude Code reads a quoted Boolean as that Boolean. There, another
      // invalid `autoAllowBashIfSandboxed` that is not `null` counts as `false`, and another
      // invalid `enabled` that is not `null` counts as `true`
      // (https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox).
      const isManaged = kindOf(context.filename) === 'managed'
      const auto = objects.map((object) =>
        boolOf(at(object, ['sandbox', 'autoAllowBashIfSandboxed']), isManaged, false),
      )
      // Before v2.1.283, an invalid managed `enabled` drops `enabled` too, so the sandbox is off.
      const dropped =
        isManaged &&
        supportsBefore(minVersion, PER_FIELD) &&
        objects.some((object) => {
          const enabled = at(object, ['sandbox', 'enabled'])
          return enabled !== undefined && enabled !== null && typeof enabled !== 'boolean'
        })
      // The rule is silent unless a file turns `enabled` on and no file turns it off. A file that
      // sets `autoAllowBashIfSandboxed` to false stops the report too. So does an unset
      // `autoAllowBashIfSandboxed`, unless `minVersion` is older than 2.1.324.
      if (
        dropped ||
        !sandboxOn(objects, isManaged) ||
        auto.includes(false) ||
        (!defaultsOn && !auto.includes(true))
      ) {
        return
      }
      for (const { loc, rule: ask } of asks) {
        const text = ask.specifier === null ? 'Bash' : `Bash(${ask.specifier})`
        context.report({ loc, messageId: 'skipped', data: { rule: text } })
      }
    })
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule
