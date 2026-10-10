// On macOS, Linux and WSL, Claude Code leaves the Glob and Grep tools out of the default tool set.
// An allow rule in a settings file does not bring them back
// (docs/rules/permissions-glob-grep-allow.md). `permissions-path-rule-tool` reads `Glob(path)`,
// and `permissions-dead-allow` owns a bare rule that a bare `deny` or `ask` rule covers.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { isDeadAllow, sourceOf } from '../permission-source.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-glob-grep-allow' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'inert' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on a Glob or Grep allow rule to restore the tool',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      inert:
        'An allow rule for `{{tool}}` in a settings file does not bring the tool back on macOS, Linux or WSL. Name it in `--tools` or `--allowedTools` when you start the session. Windows is not affected.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      const bare = entries.filter(
        ({ list, rule: { tool, specifier } }) =>
          list === 'allow' && specifier === null && (tool === 'Glob' || tool === 'Grep'),
      )
      if (bare.length === 0) {
        return
      }
      const { objects } = sourceOf(context.filename, context.sourceCode.text)
      for (const { loc, rule: parsed } of bare) {
        if (!isDeadAllow(objects, parsed)) {
          context.report({ loc, messageId: 'inert', data: { tool: parsed.tool } })
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
