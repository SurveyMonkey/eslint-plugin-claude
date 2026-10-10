// A subagent with `memory: local` keeps its memory in
// `.claude/agent-memory-local/<name>/`. That scope is for knowledge that stays
// out of version control (docs/rules/memory-agent-memory-local-untracked.md).
// The rule lints each Markdown file in that directory, and reports it when git
// tracks it. The index in `src/git-state.ts` is the source. A file that git
// does not track is the intended state, so a clone holds no such file. The rule
// makes no report when git cannot answer.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { gitModeOf } from '../git-state.ts'
import { realDirectory, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'memory-agent-memory-local-untracked' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'tracked' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep the local memory of a subagent out of git',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      tracked:
        'Git tracks "{{file}}". The "local" scope of subagent memory is for knowledge that stays out of version control. Run "git rm --cached" on it, and add ".claude/agent-memory-local/" to ".gitignore".',
    },
  },
  create(context) {
    return {
      root(node) {
        const absolute = path.resolve(context.filename)
        const bound = repositoryRoot(path.dirname(absolute))
        const file = path.join(realDirectory(path.dirname(absolute)), path.basename(absolute))
        const mode = gitModeOf(bound, file)
        if (mode !== null && mode !== UNREADABLE) {
          const data = { file: path.relative(bound, file).split(path.sep).join('/') }
          context.report({ node, messageId: 'tracked', data })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/agent-memory-local/**/*.md'],
  rule,
}
