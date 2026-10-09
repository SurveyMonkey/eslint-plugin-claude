// A value that Claude Code ignores in a project or local settings file
// (docs/rules/settings-project-value-ignored.md). The values are the ones that the settings
// reference states for each key. The rule makes no report on `bashEditDiffEnabled: true`
// (`settings-key-scope` reports it) and on `forceLoginOrgUUID` (a project value pre-selects the
// organization, so it has an effect).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type MemberNode, type ObjectNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'

const name = 'settings-project-value-ignored' as const

type MessageId =
  | 'remoteControl'
  | 'cannotTurnOff'
  | 'notStricter'
  | 'gateway'
  | 'selfHosted'
  | 'tipFeature'

/** The keys of `spinnerTipsOverride` that Claude Code reads from user, `--settings` and managed
 *  settings only. A project or local file contributes plain string tips only. */
const TIP_KEYS = ['tipsFile', 'label', 'excludeDefault']

/** The self-hosted environment IDs start with this text. */
const SELF_HOSTED_PREFIX = 'ccpool_'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a value in a project settings file that Claude Code ignores there',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      remoteControl:
        'Claude Code ignores "remoteControlAtStartup": true in a project or local settings file. A repository can turn auto-connect off, and cannot turn it on.',
      cannotTurnOff:
        'A project or local settings file cannot turn off "{{key}}". Claude Code applies a true from any file, so "false" here has no effect.',
      notStricter:
        'Claude Code ignores "crossSessionInbound": "accept" in a project or local settings file. It applies a project value only when it is stricter than the value from managed, user or --settings sources: "hold" or "refuse".',
      gateway:
        'Claude Code treats "forceLoginMethod": "gateway" as unset in a project or local settings file. Only a managed source on the machine can set it.',
      selfHosted:
        'Claude Code ignores a self-hosted environment ID in "remote.defaultEnvironmentId" in a project or local settings file. It reads one from user settings, managed settings and --settings only.',
      tipFeature:
        'Claude Code reads plain string tips only from a project or local settings file. It ignores {{what}} there.',
    },
  },
  create(context) {
    // A managed file can set each of these values.
    if (kindOf(context.filename) === 'managed') {
      return {}
    }

    /** The value of the last member `key` of `object`, as `JSON.parse` reads it. */
    const memberValue = (object: ObjectNode, key: string): MemberNode['value'] | undefined =>
      lastMember(object, key)?.value

    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }

        const remoteControl = memberValue(body, 'remoteControlAtStartup')
        if (remoteControl?.type === 'Boolean' && remoteControl.value) {
          context.report({ node: remoteControl, messageId: 'remoteControl' })
        }

        for (const key of ['isolatePeerMachines', 'disableClaudeAiConnectors']) {
          const value = memberValue(body, key)
          if (value?.type === 'Boolean' && !value.value) {
            context.report({ node: value, messageId: 'cannotTurnOff', data: { key } })
          }
        }

        const inbound = memberValue(body, 'crossSessionInbound')
        if (inbound?.type === 'String' && inbound.value === 'accept') {
          context.report({ node: inbound, messageId: 'notStricter' })
        }

        const login = memberValue(body, 'forceLoginMethod')
        if (login?.type === 'String' && login.value === 'gateway') {
          context.report({ node: login, messageId: 'gateway' })
        }

        const environment = lastMember(memberValue(body, 'remote'), 'defaultEnvironmentId')?.value
        if (environment?.type === 'String' && environment.value.startsWith(SELF_HOSTED_PREFIX)) {
          context.report({ node: environment, messageId: 'selfHosted' })
        }

        const tips = memberValue(body, 'spinnerTipsOverride')
        if (tips?.type === 'Object') {
          for (const member of tips.members) {
            const key = keyOf(member.name)
            // Two keys of one name: the last counts, as in `JSON.parse`.
            if (lastMember(tips, key) !== member) {
              continue
            }
            if (TIP_KEYS.includes(key)) {
              context.report({
                node: member.name,
                messageId: 'tipFeature',
                data: { what: `"${key}"` },
              })
            } else if (key === 'tips' && member.value.type === 'Array') {
              for (const entry of member.value.elements) {
                if (entry.value.type === 'Object') {
                  context.report({
                    node: entry.value,
                    messageId: 'tipFeature',
                    data: { what: 'a tip object' },
                  })
                }
              }
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}
