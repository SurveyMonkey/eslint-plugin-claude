// The entries of `worktree.symlinkDirectories` and `worktree.sparsePaths`
// (docs/rules/settings-worktree-paths.md). The settings reference says that each entry is a
// directory path relative to the repository root. The rule reports an entry with a leading `/` or
// a `..` segment, with no read of the disk. It then looks for the entry from the repository root,
// and reports an entry that is not there or that is a file. A path that the rule cannot see gets no
// report (ADR 001, Decision 14): a link that leads out of the repository, a dangling link, and a
// folder that it cannot read. `settings-worktree-sparse-claude-dir` reports the list as a whole,
// so the two rules never report the same node. A heuristic, and `off` in `recommended`: a
// directory such as `node_modules` is often absent from a fresh checkout.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { realSource } from '../marketplace-source.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { repositoryRoot, statOf, UNREADABLE } from '../skill-tree.ts'

const name = 'settings-worktree-paths' as const

const KEYS = ['symlinkDirectories', 'sparsePaths']

const ABSOLUTE = /^(?:[/\\]|[A-Za-z]:[/\\])/

type MessageIds = 'absolute' | 'parent' | 'missing' | 'file'

/** The fault of the entry `text`, or undefined when it is a directory, or when the rule cannot
 *  see it. `root` is the real path of the repository root. */
function faultOf(text: string, root: string): MessageIds | undefined {
  if (ABSOLUTE.test(text)) {
    return 'absolute'
  }
  if (text.split(/[/\\]/).includes('..')) {
    return 'parent'
  }
  const found = realSource(root, root, root, path.join(root, text))
  if (typeof found !== 'string') {
    return found.kind === 'missing' ? 'missing' : undefined
  }
  const stats = statOf(found)
  return stats !== null && stats !== UNREADABLE && !stats.isDirectory() ? 'file' : undefined
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a directory of the repository in the worktree path lists',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      absolute:
        '"{{path}}" starts with a slash. The entries of "worktree.{{key}}" are paths relative to the repository root.',
      parent:
        '"{{path}}" has a ".." segment. The entries of "worktree.{{key}}" are paths below the repository root.',
      missing:
        '"{{path}}" is not in the repository. The entries of "worktree.{{key}}" name directories that are there.',
      file: '"{{path}}" is a file. The entries of "worktree.{{key}}" name directories.',
    },
  },
  create(context) {
    const project = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const worktree = lastMember(node.body, 'worktree')?.value
        if (worktree === undefined) {
          return
        }
        const root = repositoryRoot(project)
        for (const key of KEYS) {
          const list = lastMember(worktree, key)?.value
          for (const { value } of list?.type === 'Array' ? list.elements : []) {
            // An entry that is not a string is for `settings-schema`.
            if (value.type !== 'String') {
              continue
            }
            const messageId = faultOf(value.value, root)
            if (messageId !== undefined) {
              context.report({ node: value, messageId, data: { key, path: value.value } })
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
