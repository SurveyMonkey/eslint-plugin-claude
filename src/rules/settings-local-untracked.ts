// Claude Code treats `.claude/settings.local.json` as the file of one person,
// and applies its allow rules with no trust step. This is not the case when
// git tracks the file, or when `.claude` is a link. Claude Code then treats
// the file as repository-supplied (docs/rules/settings-local-untracked.md).
// The file must stay out of git, so a clone may hold none. The rule lints the
// shared `.claude/settings.json` and reads its sibling by path. The link is
// read with `lstat`. The index in `src/git-state.ts` tells if git tracks the
// file. The rule makes no tracked report when git cannot answer.
import { lstatSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitModeOf } from '../git-state.ts'
import { realDirectory, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'settings-local-untracked' as const

const rule: JSONRuleDefinition<{ MessageIds: 'tracked' | 'symlink' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep settings.local.json out of git and out of a linked .claude directory',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      tracked:
        'Git tracks "{{file}}". Claude Code treats a tracked local file as repository-supplied. Its "allow" and "additionalDirectories" rules wait for workspace trust. Run "git rm --cached" on it, and add it to ".gitignore".',
      symlink:
        'The ".claude" directory is a symbolic link. Claude Code treats "settings.local.json" in it as repository-supplied, and holds its "allow" and "additionalDirectories" rules until you trust the folder. Use a real directory.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const dir = path.dirname(path.resolve(context.filename))
        let isLink = false
        try {
          isLink = lstatSync(dir).isSymbolicLink()
        } catch {
          // The linted text can be a file that is not on the disk. Then no link is there.
        }
        if (isLink) {
          context.report({ node, messageId: 'symlink' })
        }
        const file = path.join(realDirectory(dir), 'settings.local.json')
        const bound = repositoryRoot(dir)
        const mode = gitModeOf(bound, file)
        if (mode !== null && mode !== UNREADABLE) {
          const data = { file: path.relative(bound, file).split(path.sep).join('/') }
          context.report({ node, messageId: 'tracked', data })
        }
      },
    }
  },
}

export default { name, language: 'json' as const, files: ['**/.claude/settings.json'], rule }
