// A WorktreeCreate hook creates the worktree (docs/rules/hooks-worktree-create-without-remove.md).
// The hooks reference, "WorktreeRemove", says to pair it with a WorktreeRemove hook. Without one, Claude
// Code removes a worktree that git knows, and leaves any other worktree on disk.
// The rule reads one file at a time, because "the same source" is one file. A map that holds a merge
// key can hide a WorktreeRemove handler, so the rule makes no report when the WorktreeRemove event
// holds one (ADR 001, Decision 14).
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import {
  eventMember,
  HOOKS_TARGET,
  handlersOf,
  holdsUnseen,
  hooksListener,
} from '../hooks-config.ts'

const name = 'hooks-worktree-create-without-remove' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Pair a WorktreeCreate hook with a WorktreeRemove hook in the same file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noRemove:
        'This file has a WorktreeCreate hook and no WorktreeRemove hook. Claude Code then removes only a worktree that git knows. Add a WorktreeRemove hook to clean up the worktree and its branch.',
    },
  },
  create(context) {
    return hooksListener(context, (source) => {
      const events = handlersOf(source).map(({ event }) => event)
      const create = eventMember(source, 'WorktreeCreate')
      const remove = eventMember(source, 'WorktreeRemove')
      const hidden = source.partial && remove !== undefined && holdsUnseen(remove.value)
      if (
        create !== undefined &&
        events.includes('WorktreeCreate') &&
        !events.includes('WorktreeRemove') &&
        !hidden
      ) {
        context.report({ loc: create.keyLoc, messageId: 'noRemove' })
      }
    })
  },
}

export const target = { name, ...HOOKS_TARGET }

export default rule
