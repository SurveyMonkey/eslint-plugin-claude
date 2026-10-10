// The `CLAUDE.local.md` beside a `CLAUDE.md` is a personal file. Git must not
// track it, and a `.gitignore` pattern must cover it
// (docs/rules/claude-md-local-untracked.md). The file need not exist, and a
// clone that holds none still needs the pattern. So the rule lints the
// `CLAUDE.md` and reads the file in the same directory by its path. Both answers come from
// `src/git-state.ts`. The rule makes no report when git cannot answer. This
// is also the case for a directory that is a link out of the repository.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { gitIgnores, gitModeOf } from '../git-state.ts'
import { realDirectory, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'claude-md-local-untracked' as const

const LOCAL = 'CLAUDE.local.md'

const rule: MarkdownRuleDefinition<{ MessageIds: 'tracked' | 'notIgnored' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep CLAUDE.local.md out of git, and cover it with a .gitignore pattern',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      tracked:
        'Git tracks "{{file}}". It holds personal preferences, and every clone gets it. Run "git rm --cached" on it, and add it to ".gitignore".',
      notIgnored:
        'No ".gitignore" pattern covers "{{file}}". It holds personal preferences, and a commit can add it by mistake. Add the pattern to ".gitignore".',
    },
  },
  create(context) {
    return {
      root(node) {
        const dir = path.dirname(path.resolve(context.filename))
        // Claude Code loads `CLAUDE.local.md` from the project directory, not from `.claude/`.
        if (path.basename(dir) === '.claude') {
          return
        }
        const real = realDirectory(dir)
        const bound = repositoryRoot(dir)
        const file = path.join(real, LOCAL)
        const mode = gitModeOf(bound, file)
        if (mode === UNREADABLE) {
          return
        }
        const data = { file: path.relative(bound, file).split(path.sep).join('/') }
        if (mode !== null) {
          context.report({ node, messageId: 'tracked', data })
        } else if (gitIgnores(bound, file) === false) {
          context.report({ node, messageId: 'notIgnored', data })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/CLAUDE.md'], rule }
