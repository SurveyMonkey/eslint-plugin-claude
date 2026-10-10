// Two settings keys in one file where one voids the other
// (docs/rules/settings-conflicting-keys.md). A pair needs both keys in the linted file. Two
// checks need a key that a sibling file of the same managed source can set. The rule reads the
// siblings for these checks. A `null` value removes a key, so it counts as no key.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'settings-conflicting-keys' as const

type MessageId =
  | 'verbose'
  | 'tipsHidden'
  | 'workflows'
  | 'hooksOff'
  | 'focus'
  | 'vimRemaps'
  | 'autoMode'
  | 'timeZone'
  | 'channels'

/** The views that `viewMode` takes. A value outside them is for `settings-schema`. */
const VIEWS = ['default', 'verbose', 'focus']

/** The keys that run a command, and that `disableAllHooks` turns off. */
const COMMAND_KEYS = ['statusLine', 'subagentStatusLine', 'fileSuggestion']

/** The last member `key` of `object`, unless its value is `null`. */
function setMember(object: ValueNode | undefined, key: string): MemberNode | undefined {
  const member = lastMember(object, key)
  return member?.value.type === 'Null' ? undefined : member
}

/** The value of the member `key` of `object`, if it is a string. */
function stringOf(object: ValueNode | undefined, key: string): string | undefined {
  const value = setMember(object, key)?.value
  return value?.type === 'String' ? value.value : undefined
}

/** True when the member `key` of `object` is the Boolean `expected`. */
function isBoolean(object: ValueNode | undefined, key: string, expected: boolean): boolean {
  const value = setMember(object, key)?.value
  return value?.type === 'Boolean' && value.value === expected
}

/** The keys that decide a pair of the same file. A sibling of the managed source can set one of
 *  them again. Claude Code takes a single value from the later file. */
const PAIR_KEYS = [
  'viewMode',
  'tui',
  'spinnerTipsEnabled',
  'disableWorkflows',
  'disableAllHooks',
  'disableAutoMode',
  'timeFormat',
]

/** True when the object `fields` sets a key that decides a pair, at the top level or in
 *  `permissions`. */
function setsPairKey(fields: Record<string, unknown>): boolean {
  const { permissions } = fields
  const inner = typeof permissions === 'object' && permissions !== null ? permissions : {}
  return (
    PAIR_KEYS.some((key) => key in fields) || 'disableAutoMode' in inner || 'defaultMode' in inner
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a settings key that another key in the same file voids',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      verbose: '"verbose" has no effect while "viewMode" is set. "viewMode" overrides it.',
      tipsHidden:
        '"spinnerTipsOverride" has no effect while "spinnerTipsEnabled" is false. Claude Code hides all tips, yours included.',
      workflows:
        '"enableWorkflows": true has no effect while "disableWorkflows" is true. "disableWorkflows" turns workflows off.',
      hooksOff:
        'Claude Code does not run the "{{key}}" command of this file while "disableAllHooks" is true.',
      focus:
        '"viewMode": "focus" needs the fullscreen renderer, and "tui" is "default". Set "tui" to "fullscreen".',
      vimRemaps:
        '"vimInsertModeRemaps" has no effect unless "editorMode" is "vim". This file sets "editorMode" to "{{mode}}".',
      autoMode:
        '"defaultMode": "auto" has no effect while "disableAutoMode" is "disable". Sessions start in "default" mode.',
      timeZone: '"timeZone" has no effect while "timeFormat" is "24-hour-utc". Times stay in UTC.',
      channels: '"allowedChannelPlugins" has no effect unless "channelsEnabled" is true.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'

    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }
        const report = (
          member: MemberNode | undefined,
          messageId: MessageId,
          data?: Record<string, string>,
        ) => {
          if (member !== undefined) {
            context.report({ node: member.name, messageId, data })
          }
        }

        // The managed source is `managed-settings.json` and its drop-ins, merged. A sibling that
        // the rule cannot read can set any key, so the two checks that need a sibling stay silent.
        const siblings = isManaged ? readManagedSource(context.filename) : []

        // A sibling can set a key of a pair again, and the later file wins. The rule cannot tell
        // which file is later in every case, so the pairs of one file stay silent then.
        const settled = siblings === UNREADABLE || siblings.some(setsPairKey)
        const pair = settled ? () => undefined : report

        const view = stringOf(body, 'viewMode')
        if (view !== undefined && VIEWS.includes(view)) {
          pair(setMember(body, 'verbose'), 'verbose')
        }

        if (isBoolean(body, 'spinnerTipsEnabled', false)) {
          pair(setMember(body, 'spinnerTipsOverride'), 'tipsHidden')
        }

        if (isBoolean(body, 'disableWorkflows', true) && isBoolean(body, 'enableWorkflows', true)) {
          pair(setMember(body, 'enableWorkflows'), 'workflows')
        }

        if (isBoolean(body, 'disableAllHooks', true)) {
          for (const key of COMMAND_KEYS) {
            pair(setMember(body, key), 'hooksOff', { key })
          }
        }

        if (view === 'focus' && stringOf(body, 'tui') === 'default') {
          pair(setMember(body, 'viewMode'), 'focus')
        }

        // Claude Code reads the remaps from user and managed settings. `settings-key-scope`
        // reports the key in a project file, so this check leaves that file alone.
        const mode = stringOf(body, 'editorMode')
        if (
          isManaged &&
          mode !== undefined &&
          mode !== 'vim' &&
          siblings !== UNREADABLE &&
          !siblings.some((fields) => fields.editorMode === 'vim')
        ) {
          report(setMember(body, 'vimInsertModeRemaps'), 'vimRemaps', { mode })
        }

        const permissions = lastMember(body, 'permissions')?.value
        if (
          stringOf(body, 'disableAutoMode') === 'disable' ||
          stringOf(permissions, 'disableAutoMode') === 'disable'
        ) {
          if (stringOf(permissions, 'defaultMode') === 'auto') {
            pair(setMember(permissions, 'defaultMode'), 'autoMode')
          }
        }

        if (stringOf(body, 'timeFormat') === '24-hour-utc') {
          pair(setMember(body, 'timeZone'), 'timeZone')
        }

        // Both keys are managed-only. `settings-key-scope` reports them in a project file. A
        // `channelsEnabled` of another type is for `settings-schema`.
        const enabled = setMember(body, 'channelsEnabled')
        if (
          isManaged &&
          (enabled === undefined || isBoolean(body, 'channelsEnabled', false)) &&
          siblings !== UNREADABLE &&
          !siblings.some((fields) => fields.channelsEnabled === true)
        ) {
          report(setMember(body, 'allowedChannelPlugins'), 'channels')
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}
