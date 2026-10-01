// Claude Code finds a skill only as `skills/<name>/SKILL.md`
// (docs/rules/skill-file-layout.md). The rule reports the two files that it
// can see: a loose `.md` file in `skills/`, and a `skill.md` of the wrong case.
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { isPluginRoot } from '../plugin-root.ts'

const name = 'skill-file-layout' as const

/** True when `dir` is `.claude/skills/` or the `skills/` directory of a plugin. */
function isSkillsDir(dir: string): boolean {
  const parent = path.dirname(dir)
  return (
    path.basename(dir) === 'skills' && (path.basename(parent) === '.claude' || isPluginRoot(parent))
  )
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'loose' | 'wrongCase' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put each skill in a folder, in a file named SKILL.md',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      loose:
        '`{{file}}` is a loose file in `skills/`. Claude Code does not find it. Move it to `{{stem}}/SKILL.md`.',
      wrongCase:
        '`{{file}}` is not named `SKILL.md`. Claude Code does not find this skill. Rename the file.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const base = path.basename(file)
    const folder = path.dirname(file)
    const first = { line: 1, column: 1 }
    return {
      root() {
        if (isSkillsDir(folder)) {
          // A README does not claim to be a skill.
          if (base.toLowerCase() !== 'readme.md') {
            context.report({
              loc: first,
              messageId: 'loose',
              data: { file: base, stem: path.basename(base, '.md') },
            })
          }
          return
        }
        if (
          isSkillsDir(path.dirname(folder)) &&
          base !== 'SKILL.md' &&
          base.toLowerCase() === 'skill.md' &&
          !existsSync(path.join(folder, 'SKILL.md'))
        ) {
          context.report({ loc: first, messageId: 'wrongCase', data: { file: base } })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/skills/*.md', '**/skills/*/*.md'],
  rule,
}
