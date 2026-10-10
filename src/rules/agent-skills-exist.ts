// Each `skills` entry of a subagent names a skill that Claude Code can find. Claude Code skips an
// entry that it cannot find and writes a warning to the debug log
// (docs/rules/agent-skills-exist.md). `agent-skills-preloadable` reports a skill that a subagent
// cannot preload.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { type AgentFile, classifyAgentFile } from '../agent-files.ts'
import { BUNDLED_SKILLS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { foldersAbove } from '../folders-above.ts'
import { listEntries } from '../frontmatter-list.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  entriesOf,
  frontmatterOfFile,
  isInside,
  readManifest,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'agent-skills-exist' as const

type Options = [{ allow: string[] }]

/** The skill names that a scan found. `unseen` is true when the scan could not read a part of a
 *  skills folder, or a skill that it meets leads out of the repository. A skill can then be out
 *  of sight. */
interface Skills {
  names: string[]
  unseen: boolean
}

/** The folder name and the `name` of each skill in the `skills/` directory `dir`, and the name
 *  of each command file in the `commands/` directory `commands`. A command file creates the same
 *  command as a skill of its name. A folder with no `SKILL.md` is no skill. */
function skillsIn(dir: string, commands: string, bound: string, found: Skills): void {
  const folders = entriesOf(dir)
  if (folders === UNREADABLE) {
    found.unseen = true
  }
  for (const folder of Array.isArray(folders) ? folders : []) {
    const file = path.join(dir, folder.name, 'SKILL.md')
    const real = realOf(file)
    if (real === UNREADABLE || (typeof real === 'string' && !isInside(real, bound))) {
      found.unseen = true
    } else if (real !== null) {
      found.names.push(folder.name)
      const fields = frontmatterOfFile(file)
      if (fields === UNREADABLE) {
        found.unseen = true
      } else if (typeof fields?.name === 'string') {
        found.names.push(fields.name)
      }
    }
  }
  const files = entriesOf(commands)
  if (files === UNREADABLE) {
    found.unseen = true
  }
  for (const file of Array.isArray(files) ? files : []) {
    if (file.name.endsWith('.md')) {
      found.names.push(file.name.slice(0, -'.md'.length))
    }
  }
}

/** The skills that an agent in `scope` can preload from the repository. A local agent sees the
 *  `.claude/` directory of each project folder. A plugin agent sees its own plugin. The names are
 *  null when the rule cannot know them: a plugin manifest that sets `skills` adds directories,
 *  and a manifest that the rule cannot read can set it. */
function skillsOf(scope: AgentFile, bound: string): Skills | null {
  const found: Skills = { names: [], unseen: false }
  if (scope.plugin) {
    const manifest = readManifest(scope.root, bound)
    if (manifest === UNREADABLE || (manifest !== null && 'skills' in manifest)) {
      return null
    }
    skillsIn(path.join(scope.root, 'skills'), path.join(scope.root, 'commands'), bound, found)
    return found
  }
  for (const dir of [path.dirname(scope.root), ...foldersAbove(scope.root)]) {
    const claude = path.join(dir, '.claude')
    skillsIn(path.join(claude, 'skills'), path.join(claude, 'commands'), bound, found)
  }
  return found
}

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a skill that exists in the skills of a subagent',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      missing:
        '`{{entry}}` is not a bundled skill, and no skill or command of this repository has that name. Claude Code skips it and writes a warning to the debug log. Name a skill from outside the repository in the option `allow`.',
    },
  },
  create(context) {
    const scope = classifyAgentFile(context.filename)
    if (scope === null) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        // A value that is not a list is the business of `agent-frontmatter-schema`.
        if (fm === null || !Array.isArray(fm.data.skills)) {
          return
        }
        // The docs do not say if Claude Code compares a skill name with case.
        const same = (entry: string) => (other: string) =>
          other.toLowerCase() === entry.toLowerCase()
        const entries = listEntries(fm, node.value, 'skills', () => false).filter(
          // A name with a `:` is a plugin skill or a command in a folder. The docs give no rule
          // for that form in `skills`. A bundled skill and an allowed name are out of sight.
          ({ text }) =>
            !text.includes(':') && !BUNDLED_SKILLS.some(same(text)) && !allow.some(same(text)),
        )
        if (entries.length === 0) {
          return
        }
        const found = skillsOf(scope, repositoryRoot(scope.root))
        if (found === null || found.unseen) {
          return
        }
        for (const { text, loc } of entries) {
          if (!found.names.some(same(text))) {
            context.report({ loc, messageId: 'missing', data: { entry: text } })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }
