// A bare `Bash` ask rule, or `Bash(*)`, is skipped for a command that runs in the sandbox while
// `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is not false
// (https://code.claude.com/docs/en/permissions#how-permissions-interact-with-sandboxing). The
// rule adds up the project pair, or one managed source. The rule makes no report when it cannot
// read a file of the source, because that file can set `autoAllowBashIfSandboxed` to `false`. It
// does not read plan mode, an excluded command or `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`
// (docs/rules/permissions-sandbox-bash-ask.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { at, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-sandbox-bash-ask' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'skipped' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not rely on a bare Bash ask rule while the sandbox auto-allows Bash',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skipped:
        '`{{rule}}` is skipped for a command that runs in the sandbox, because `sandbox.enabled` is true and `autoAllowBashIfSandboxed` is not false. Set `autoAllowBashIfSandboxed` to false, or scope the rule, as `Bash(git push *)`.',
    },
  },
  create(context) {
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
      const values = (key: string) => objects.map((object) => at(object, ['sandbox', key]))
      // A file that sets `enabled` to false, or `autoAllowBashIfSandboxed` to false, ends the skip.
      if (
        !values('enabled').includes(true) ||
        values('enabled').includes(false) ||
        values('autoAllowBashIfSandboxed').includes(false)
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

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
