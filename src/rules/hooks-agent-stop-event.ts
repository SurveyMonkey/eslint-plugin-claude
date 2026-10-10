// Claude Code converts a `Stop` hook in the frontmatter of a subagent to `SubagentStop`
// (docs/rules/hooks-agent-stop-event.md). The hooks reference, "Hooks in skills and agents", and the
// subagents page say so. The rule reads the frontmatter of a project subagent only. A skill keeps its
// `Stop` event, and a plugin agent has its `hooks` field ignored.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { eventMember, HOOKS_TARGET, handlersOf, hooksListener } from '../hooks-config.ts'

const name = 'hooks-agent-stop-event' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use SubagentStop, not Stop, in the hooks of a subagent',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      stop: 'Claude Code converts a "Stop" hook in subagent frontmatter to "SubagentStop". Use "SubagentStop". Keep "Stop" only for an agent that you run as the main session.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const stop = eventMember(source, 'Stop')
      if (
        source.kind === 'agent' &&
        stop !== undefined &&
        handlersOf(source).some(({ event }) => event === 'Stop')
      ) {
        context.report({ loc: stop.keyLoc, messageId: 'stop' })
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }
