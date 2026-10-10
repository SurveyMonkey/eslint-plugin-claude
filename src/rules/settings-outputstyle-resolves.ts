// The `outputStyle` value of a project or local settings file must name a style that Claude Code
// can load (docs/rules/settings-outputstyle-resolves.md). Claude Code compares the value with
// case. A value that matches no style gives the Default style. The rule reads the
// `.claude/output-styles/` directories of the project. The option `allow` lists the user and
// plugin styles that a repository cannot show. The rule does not read a managed file. A managed
// file applies to every project on a machine. The project styles that it names are not in the
// repository that holds it.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import {
  danglingOf,
  frontmatterOfFile,
  isInside,
  markdownFiles,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'settings-outputstyle-resolves' as const

type Options = [{ allow: string[] }]

/** The built-in styles of https://code.claude.com/docs/en/output-styles#built-in-output-styles.
 *  `default` is the name that the `/output-style` list shows for the style with no instructions. */
const BUILT_IN = ['default', 'Proactive', 'Concise', 'Explanatory', 'Learning']

/** The names of the custom styles that a scan found. `unseen` is true in two cases. The scan did
 *  not follow a link out of the repository, or it could not read a path. A style can then be out
 *  of sight. */
interface Styles {
  names: string[]
  unseen: boolean
}

/** `start` and each directory above it, up to the real path `top`. The walk goes up the path as
 *  given. A directory counts when its real path is at or below `top`. So a link above the project
 *  does not hide `top`. The walk stops at `top`, so no call reaches a path above the repository
 *  (ADR 001, Decision 14). It also stops at the root of the file system. */
function ancestors(start: string, top: string): string[] {
  const chain: string[] = []
  for (let at = start; ; at = path.dirname(at)) {
    const real = realDirectory(at)
    if (isInside(real, top)) {
      chain.push(at)
    }
    if (real === top || at === path.parse(at).root) {
      break
    }
  }
  return chain
}

/** The names of the custom styles in `.claude/output-styles/` of `start`, and of each directory
 *  above it up to `top`. A style has two names: its file name without `.md`, and the `name` field
 *  of its frontmatter. Claude Code uses the field when it is there, and the rule accepts both. The
 *  scans read no file out of `bound`. */
function customStyles(start: string, top: string, bound: string): Styles {
  const found: Styles = { names: [], unseen: false }
  for (const dir of ancestors(start, top)) {
    const styles = path.join(dir, '.claude', 'output-styles')
    const scan = markdownFiles(styles, bound)
    // A dangling link is an entry, and it can lead to styles (ADR 001, Decision 14).
    found.unseen ||=
      scan.outside || scan.unreadable || (realOf(styles) === null && danglingOf(styles) !== null)
    for (const file of scan.files) {
      const fields = frontmatterOfFile(file)
      found.unseen ||= fields === UNREADABLE
      found.names.push(path.basename(file, '.md'))
      const given = fields === UNREADABLE ? undefined : fields?.name
      if (typeof given === 'string') {
        found.names.push(given)
      }
    }
  }
  return found
}

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'unknown' | 'caseMismatch'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name an output style that Claude Code can load in the outputStyle setting',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      unknown:
        '"{{style}}" is not a built-in output style, and no file in .claude/output-styles/ has that name. Claude Code uses the Default style.',
      caseMismatch:
        'Claude Code compares "outputStyle" with case, and "{{style}}" matches no style. It uses the Default style. Write "{{match}}".',
    },
  },
  create(context) {
    const [{ allow }] = context.options
    return {
      Document(node) {
        const value = lastMember(node.body, 'outputStyle')?.value
        if (
          value?.type !== 'String' ||
          BUILT_IN.includes(value.value) ||
          allow.includes(value.value)
        ) {
          return
        }
        const style = value.value
        // The project directory holds `.claude/`. The rule reads no file out of the repository
        // that holds the project.
        const claudeDir = path.dirname(path.resolve(context.filename))
        const project = path.dirname(claudeDir)
        const styles = customStyles(project, repositoryRoot(project), repositoryRoot(claudeDir))
        // A path that the rule cannot read can hold the style. The rule cannot prove that the
        // style is absent.
        if (styles.unseen || styles.names.includes(style)) {
          return
        }
        const match = [...BUILT_IN, ...allow, ...styles.names].find(
          (known) => known.toLowerCase() === style.toLowerCase(),
        )
        context.report({
          node: value,
          messageId: match === undefined ? 'unknown' : 'caseMismatch',
          data: { style, match: match ?? '' },
        })
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
