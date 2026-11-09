// An `env` variable that a settings file cannot set
// (docs/rules/settings-env-ignored-var.md). The lists are in `src/data/settings-env.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  CREDENTIAL_ENV_VARS,
  envIgnoredIn,
  ignoresValueInProjectFiles,
  removedEnvVarSince,
  turnsTelemetryOff,
} from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-env-ignored-var' as const

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'everyFile' | 'projectFiles' | 'projectFilesValue' | 'removed'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set an env variable that Claude Code ignores in a settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      everyFile: 'Claude Code ignores "{{name}}" in the env block of every settings file.',
      projectFiles:
        'Claude Code ignores "{{name}}" in the env block of a project or local settings file. Set it in your shell, user settings, or managed settings.',
      projectFilesValue:
        'Claude Code ignores "{{name}}" set to "{{value}}" in the env block of a project or local settings file. Set it in your shell, user settings, or managed settings.',
      removed: 'Claude Code ignores "{{name}}" since v{{since}}. The variable has no effect.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isProjectFile = kindOf(context.filename) !== 'managed'
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        if (env?.type !== 'Object') {
          return
        }
        for (const member of env.members) {
          const variable = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(env, variable) !== member) {
            continue
          }
          const { value } = member
          // `settings-env-credential` reports a credential that has text. One report for one
          // fault: `CLAUDE_CODE_OAUTH_TOKEN` is in both lists. An empty or a non-string value is
          // no credential for that rule, so this rule still reports it.
          if (
            CREDENTIAL_ENV_VARS.includes(variable) &&
            value.type === 'String' &&
            value.value.trim() !== ''
          ) {
            continue
          }
          const since = removedEnvVarSince(variable)
          const ignoredIn = envIgnoredIn(variable)
          if (since !== undefined) {
            context.report({
              node: member.name,
              messageId: 'removed',
              data: { name: variable, since },
            })
          } else if (ignoredIn === 'every-file') {
            context.report({ node: member.name, messageId: 'everyFile', data: { name: variable } })
          } else if (
            ignoredIn === 'project-files' &&
            isProjectFile &&
            !(value.type === 'String' && turnsTelemetryOff(variable, value.value))
          ) {
            context.report({
              node: member.name,
              messageId: 'projectFiles',
              data: { name: variable },
            })
          } else if (
            isProjectFile &&
            value.type === 'String' &&
            ignoresValueInProjectFiles(variable, value.value)
          ) {
            context.report({
              node: member.name,
              messageId: 'projectFilesValue',
              data: { name: variable, value: value.value },
            })
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule
