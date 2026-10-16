// A project `.gitignore` must cover `.claude/settings.local.json`
// (docs/rules/settings-local-gitignored.md). Claude Code adds the pattern to the
// global excludes file the first time it writes the file. A file that a person
// creates by hand has no such pattern, and a commit can add it. The file may not
// exist. So the rule lints the shared `.claude/settings.json`. It asks
// `git check-ignore` (`src/git-state.ts`) about the file in the same directory.
// The rule makes no report when git cannot answer. This is also the case when
// `.claude` is a link, because git then stops with an error.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { gitIgnores } from '../git-state.ts'
import { realDirectory, repositoryRoot } from '../skill-tree.ts'

const name = 'settings-local-gitignored' as const

const rule: JSONRuleDefinition<{ MessageIds: 'notIgnored' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Cover settings.local.json with a .gitignore pattern',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notIgnored:
        'No ".gitignore" pattern covers "{{file}}". Claude Code adds the pattern to your global excludes file only when it writes the file. A file that you create by hand has no such pattern, and a commit can add it. Add "**/.claude/settings.local.json" to ".gitignore".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const dir = path.dirname(path.resolve(context.filename))
        const bound = repositoryRoot(dir)
        // The real path of the parent, so that a link `.claude` stays a link in the path.
        const file = path.join(realDirectory(path.dirname(dir)), '.claude', 'settings.local.json')
        if (gitIgnores(bound, file) === false) {
          const data = { file: path.relative(bound, file).split(path.sep).join('/') }
          context.report({ node, messageId: 'notIgnored', data })
        }
      },
    }
  },
}

export const target = { name, language: 'json' as const, files: ['**/.claude/settings.json'] }

export default rule
