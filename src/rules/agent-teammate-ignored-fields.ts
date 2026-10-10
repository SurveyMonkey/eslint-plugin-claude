// Claude Code applies a subagent definition to a teammate in part
// (docs/rules/agent-teammate-ignored-fields.md). Teammate use is a runtime fact. The files show
// one fact: the committed settings turn agent teams on. While teams are on, a subagent that
// Claude names launches as a teammate. So the rule is a heuristic. It checks local agents only.
// A plugin cannot turn teams on, and `agent-plugin-ignored-fields` owns `mcpServers` there.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted } from '../agent-files.ts'
import { envOf, isOn, localAgentSettings } from '../agent-settings.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-teammate-ignored-fields' as const

const TEAMS = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'

// The values of `teammateMode` that open a split pane for each teammate. A split-pane teammate
// applies `mcpServers`.
const SPLIT_PANES = ['tmux', 'iterm2']

/** True when a field has a value that sets it: a list with an entry, a string with text, a
 *  mapping with a key, or any other value that is not null. */
function isSet(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0
  }
  return typeof value === 'string' ? value.trim() !== '' : value !== null
}

type MessageId = 'skills' | 'mcpServers' | 'background'

// The fields that a teammate does not use as a subagent does, with the test for a value that
// sets the field. Another rule reports a value of the wrong type.
const CHECKS = new Map<string, { id: MessageId; set: (value: unknown) => boolean }>([
  ['skills', { id: 'skills', set: isSet }],
  ['mcpServers', { id: 'mcpServers', set: isSet }],
  ['background', { id: 'background', set: (value) => readBoolean(value) === true }],
])

const rule: MarkdownRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Leave out the subagent fields that Claude Code ignores for a teammate, when the settings turn agent teams on',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      skills:
        'The settings turn agent teams on, so Claude can launch this agent as a teammate. Claude Code never applies `skills` to a teammate. The teammate loads the skills of the project and the user.',
      mcpServers:
        'The settings turn agent teams on, so Claude can launch this agent as a teammate. An in-process teammate ignores `mcpServers`. A split-pane teammate applies it. The rule cannot see the display mode.',
      background:
        'The settings turn agent teams on. Claude Code returns an error when a teammate spawns an agent with `background: true`.',
    },
  },
  create(context) {
    const scope = classifyLinted(context)
    if (scope === null || scope.plugin) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        const found: { id: MessageId; start: number; end: number }[] = []
        for (const { key, keyStart, valueEnd } of fm.fields.values()) {
          const check = CHECKS.get(key)
          if (check?.set(fm.data[key])) {
            found.push({ id: check.id, start: keyStart, end: valueEnd })
          }
        }
        if (found.length === 0) {
          return
        }
        const settings = localAgentSettings(context.filename)
        if (settings === null || settings === UNREADABLE || !isOn(envOf(settings)[TEAMS])) {
          return
        }
        const split = SPLIT_PANES.includes(settings.teammateMode as string)
        for (const { id, start, end } of found) {
          if (id !== 'mcpServers' || !split) {
            context.report({ loc: fm.at(start, end), messageId: id })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/*.md'], rule }
