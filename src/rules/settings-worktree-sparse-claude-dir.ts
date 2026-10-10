// `worktree.sparsePaths` without `.claude` (docs/rules/settings-worktree-sparse-claude-dir.md).
// A sparse worktree gets the listed directories and the root-level files. Root-level directories
// are not in it, so `.claude/settings.json` and `.claude/rules/` are absent from the worktree.
// The large codebases page says that the lists of the scopes merge. So the rule also reads the
// files that Claude Code merges with the linted file: the other project file of the same
// `.claude/` folder, or the other files of the managed source. A file that the rule cannot read
// can hold `.claude`, so the rule then makes no report (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  isHiddenDropIn,
  kindOf,
  MANAGED_SETTINGS_FILES,
  readManagedSource,
} from '../settings-files.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'settings-worktree-sparse-claude-dir' as const

const CLAUDE_DIR = '.claude'

/** True when `entry` names the directory `.claude` of the repository root. A `./` at the
 *  start and a `/` at the end do not change the path. */
const isClaudeDir = (entry: unknown) =>
  typeof entry === 'string' && path.posix.normalize(entry).replace(/\/+$/, '') === CLAUDE_DIR

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** True when the parsed settings object `data` lists `.claude` in `worktree.sparsePaths`. */
function listsClaudeDir(data: Record<string, unknown>): boolean {
  const { worktree } = data
  const paths = isObject(worktree) ? worktree.sparsePaths : undefined
  return Array.isArray(paths) && paths.some(isClaudeDir)
}

/** The parsed objects of the other settings files that Claude Code merges with `filename`, or
 *  `UNREADABLE` when one of them cannot be seen. */
function siblingsOf(filename: string): Record<string, unknown>[] | typeof UNREADABLE {
  if (kindOf(filename) === 'managed') {
    return readManagedSource(filename)
  }
  const dir = path.dirname(path.resolve(filename))
  const other =
    path.basename(filename) === 'settings.json' ? 'settings.local.json' : 'settings.json'
  const parsed = readJson(path.join(dir, other), repositoryRoot(dir))
  if (parsed === null) {
    return []
  }
  return parsed === UNREADABLE || !isObject(parsed.data) ? UNREADABLE : [parsed.data]
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'omitted' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'List .claude in worktree.sparsePaths',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      omitted:
        '"worktree.sparsePaths" does not list ".claude". A sparse worktree then has no ".claude/settings.json" and no ".claude/rules/" of the repository root.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const paths = lastMember(lastMember(node.body, 'worktree')?.value, 'sparsePaths')?.value
        // An empty list may mean no sparse checkout, so the rule reads it as unset. A value that
        // is not a list is for `settings-schema`.
        if (paths?.type !== 'Array' || paths.elements.length === 0) {
          return
        }
        if (
          paths.elements.some(({ value }) => value.type === 'String' && isClaudeDir(value.value))
        ) {
          return
        }
        const siblings = siblingsOf(context.filename)
        if (siblings === UNREADABLE || siblings.some(listsClaudeDir)) {
          return
        }
        context.report({ node: paths, messageId: 'omitted' })
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
