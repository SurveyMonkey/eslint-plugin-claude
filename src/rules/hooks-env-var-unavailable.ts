// A hook command that reads an environment variable that Claude Code does not set for it
// (docs/rules/hooks-env-var-unavailable.md). `CLAUDE_ENV_FILE` is set for `SessionStart`, `Setup`,
// `CwdChanged` and `FileChanged` hooks only. No `CLAUDE_MODEL` variable exists. The rule reads
// the `command` string and each string item of `args`. It makes no `CLAUDE_ENV_FILE` report on an
// unknown event. `hooks-event-name-known` reports the name.
import type { Rule } from 'eslint'
import { ENV_FILE_EVENTS, HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import {
  HOOKS_TARGET,
  handlersOf,
  hooksListener,
  memberOf,
  quotedList,
  stringOf,
} from '../hooks-config.ts'

const name = 'hooks-env-var-unavailable' as const

/** A reference to the variable `variable`: `$NAME`, `${NAME}`, `$env:NAME` or `${env:NAME}`. The `env:` prefix has any letter case. */
const reference = (variable: string) =>
  new RegExp(`\\$\\{?(?:[Ee][Nn][Vv]:)?${variable}(?![A-Za-z0-9_])`)

const ENV_FILE = reference('CLAUDE_ENV_FILE')
const MODEL = reference('CLAUDE_MODEL')

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Read only a variable that Claude Code sets for the hook event',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      envFile: `Claude Code sets CLAUDE_ENV_FILE for ${quotedList(ENV_FILE_EVENTS)} hooks only. A {{event}} hook has no such variable.`,
      model:
        'Claude Code sets no CLAUDE_MODEL variable, so it is always empty. Read "model" in the input of a SessionStart hook, or set ANTHROPIC_MODEL.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      for (const { event, handler } of handlersOf(source)) {
        if (stringOf(handler, 'type') !== 'command') {
          continue
        }
        const args = memberOf(handler, 'args')?.value
        const nodes = [
          memberOf(handler, 'command')?.value,
          ...(args?.kind === 'array' ? args.items : []),
        ]
        const noEnvFile = HOOK_EVENTS.includes(event) && !ENV_FILE_EVENTS.includes(event)
        for (const node of nodes) {
          if (node?.kind !== 'string') {
            continue
          }
          if (noEnvFile && ENV_FILE.test(node.value)) {
            context.report({ loc: node.loc, messageId: 'envFile', data: { event } })
          }
          if (MODEL.test(node.value)) {
            context.report({ loc: node.loc, messageId: 'model' })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
