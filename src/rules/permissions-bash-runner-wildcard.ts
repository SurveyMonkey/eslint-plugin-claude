// A rule such as `Bash(devbox run *)` matches whatever comes after the runner,
// such as `devbox run rm -rf .`. The wrapper list of Claude Code does not
// hold the runners that run their arguments as a command
// (docs/rules/permissions-bash-runner-wildcard.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { BASH_RULE_TOOLS } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-bash-runner-wildcard' as const

type Options = [{ runners: string[] }]

/** The environment runners that the permissions page names. Source: the
 *  "Wrappers" part of the Bash section
 *  (https://code.claude.com/docs/en/permissions#process-wrappers), checked on
 *  2026-10-10. */
const DEFAULT_RUNNERS = ['direnv exec', 'devbox run', 'mise exec', 'npx', 'docker exec']

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'runner' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write one Bash allow rule for each inner command of an environment runner',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          runners: {
            type: 'array',
            items: { type: 'string', pattern: '\\S' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ runners: DEFAULT_RUNNERS }],
    messages: {
      runner:
        '`{{rule}}` approves any command that `{{runner}}` runs, because the `*` matches whatever comes after the runner. Write one rule for each inner command, such as `{{example}}`.',
    },
  },
  create(context) {
    const [{ runners }] = context.options
    const split = runners.map((runner) => runner.split(/\s+/).filter((word) => word !== ''))
    return settingsListener(context, (entries) => {
      for (const { list, loc, rule: parsed } of entries) {
        if (
          list !== 'allow' ||
          parsed.specifier === null ||
          !BASH_RULE_TOOLS.includes(parsed.tool)
        ) {
          continue
        }
        const words = commandWords(parsed.specifier)
        const match = split.find(
          (runner) =>
            words.length === runner.length + 1 &&
            words.at(-1) === '*' &&
            runner.every((word, i) => words[i] === word),
        )
        if (match !== undefined) {
          const runner = match.join(' ')
          context.report({
            loc,
            messageId: 'runner',
            data: {
              rule: `${parsed.tool}(${parsed.specifier})`,
              runner,
              example: `${parsed.tool}(${runner} npm test)`,
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
