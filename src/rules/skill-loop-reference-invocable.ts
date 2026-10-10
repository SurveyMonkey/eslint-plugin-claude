// A scheduled fire passes the prompt to Claude as plain text. A skill that sets
// `disable-model-invocation: true` does not run (docs/rules/skill-loop-reference-invocable.md).
// The rule reads `.claude/loop.md`, and the skill or command file that its first line names.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  repositoryRoot,
  skillScan,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'skill-loop-reference-invocable' as const

// The first line that is not blank starts with `/` and the name of a skill. The docs show a prompt that is a skill: `/loop 20m /review-pr 1234`.
const SKILL_PROMPT = /^(?:[ \t]*\r?\n)*\/(\S+)/

/** True when the file `file` sets `disable-model-invocation: true`. False when the file has no
 *  frontmatter, or does not set it. `UNREADABLE` when the rule cannot read the file. */
function manualOnly(file: string): boolean | typeof UNREADABLE {
  const fields = frontmatterOfFile(file)
  if (fields === UNREADABLE) {
    return UNREADABLE
  }
  return readBoolean(fields?.['disable-model-invocation']) === true
}

/** The state of each skill or command file that `/<invoked>` runs, in the `.claude/` folder
 *  `scope`. A skill wins over a command file of the same name. The array is empty when nothing
 *  in that folder has the name. It holds `UNREADABLE` when the rule cannot see a file that could
 *  have the name. */
function targets(scope: string, invoked: string): (boolean | typeof UNREADABLE)[] {
  const bound = repositoryRoot(scope)
  const scan = skillScan(path.join(scope, 'skills'), bound)
  const skills = scan.files.filter((file) => {
    const given = frontmatterOfFile(file)
    // A skill is invoked by its folder name, and by its `name`. A file that the rule cannot read
    // can have any `name`, so it counts as a match.
    return (
      path.basename(path.dirname(file)) === invoked ||
      given === UNREADABLE ||
      given?.name === invoked
    )
  })
  // A skill that the rule cannot see could have the name, and it would win over a command file.
  const hidden: (typeof UNREADABLE)[] = scan.skipped ? [UNREADABLE] : []
  if (skills.length > 0 || hidden.length > 0) {
    return [...skills.map(manualOnly), ...hidden]
  }
  const commandsDir = path.join(scope, 'commands')
  const commands = markdownFiles(commandsDir, bound)
  const named = commands.files
    .filter(
      (file) =>
        path.relative(commandsDir, file).replace(/\.md$/, '').split(path.sep).join(':') === invoked,
    )
    .map(manualOnly)
  return commands.unreadable || commands.outside ? [...named, UNREADABLE] : named
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'manualOnly' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not start loop.md with a skill that only the user can invoke',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      manualOnly:
        '`/{{name}}` sets `disable-model-invocation: true`. A scheduled fire passes the prompt to Claude as plain text, so the loop does not run the skill. Remove the field, or write the steps in this file.',
    },
  },
  create(context) {
    const { sourceCode } = context
    return {
      root() {
        const invoked = SKILL_PROMPT.exec(sourceCode.text)
        if (invoked === null) {
          return
        }
        const states = targets(path.dirname(path.resolve(context.filename)), invoked[1] as string)
        // A name that nothing in the repository has, or a file that the rule cannot read, gives no
        // report. So does a skill that Claude can invoke.
        if (states.length === 0 || !states.every((state) => state === true)) {
          return
        }
        const start = invoked[0].length - (invoked[1] as string).length - 1
        context.report({
          loc: {
            start: sourceCode.getLocFromIndex(start),
            end: sourceCode.getLocFromIndex(start + 1 + (invoked[1] as string).length),
          },
          messageId: 'manualOnly',
          data: { name: invoked[1] as string },
        })
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/loop.md'],
  rule,
}
