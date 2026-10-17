// `--plugin-dir` takes the root of a plugin (docs/rules/plugin-dir-not-marketplace-root.md). At a
// marketplace root, Claude Code does not read `marketplace.json`, so the plugins under `plugins/`
// do not load, and no error shows. `CLAUDE_CODE_PLUGIN_DIRS` loads each path the way the flag does.
// The rule reads the `scripts` of a `package.json`, because the plugin lints JSON and Markdown
// only. It resolves a path from the folder of the file. It makes no report for a path that it
// cannot resolve inside the repository (ADR 001, Decision 14).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, pluginEntries } from '../marketplace-json.ts'
import { realSource, sourceReader } from '../marketplace-source.ts'
import { lastMembers, readJsonBody } from '../mcp-servers.ts'
import { hasManifest } from '../plugin-root.ts'
import { wordsOf } from '../script-refs.ts'
import { isInside, readJson, realDirectory, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'plugin-dir-not-marketplace-root' as const

const FLAG = '--plugin-dir'
const ENV = 'CLAUDE_CODE_PLUGIN_DIRS='

// A path with one of these characters can hold a variable, a substitution, a glob or a home path.
// The rule cannot resolve it.
const UNRESOLVED = /[$`*?[\]{}\\~!#=]/

/** The paths that a script gives to Claude Code, each with the name of the way. A relative path
 *  of `CLAUDE_CODE_PLUGIN_DIRS` is not in the result, because Claude Code skips it. */
function pluginDirs(script: string): { value: string; source: string }[] {
  const words = wordsOf(script)
  return words.flatMap((word, index) => {
    if (word === FLAG) {
      return words.slice(index + 1, index + 2).map((value) => ({ value, source: FLAG }))
    }
    if (word.startsWith(`${FLAG}=`)) {
      return [{ value: word.slice(FLAG.length + 1), source: FLAG }]
    }
    return word.startsWith(ENV)
      ? word
          .slice(ENV.length)
          .split(/[:;]/)
          .filter((value) => path.isAbsolute(value))
          .map((value) => ({ value, source: ENV.slice(0, -1) }))
      : []
  })
}

/** True when each entry of the `marketplace.json` at `file` has the folder `real` as its source.
 *  `--plugin-dir` then loads the standard layout of that folder. The result is also true when the
 *  rule cannot see the source of an entry (ADR 001, Decision 14). A file that does not parse, and
 *  a file with no entry, give false. */
function listsOnlyItself(file: string, real: string, bound: string): boolean {
  const body = readJsonBody(file, bound)
  if (body === null) {
    return false
  }
  const read = sourceReader(file, { body })
  const found = pluginEntries({ body }).map(read)
  return (
    found.some((source) => source.kind === 'unreadable') ||
    (found.length > 0 &&
      found.every((source) => source.kind === 'no-manifest' && source.dir === real))
  )
}

/** True when `value`, from the folder `base`, is a folder that holds `.claude-plugin/marketplace.json`
 *  and no `.claude-plugin/plugin.json`. A folder with both is a plugin root too, and Claude Code
 *  loads it. A file that does not parse still marks the folder. A marketplace whose each entry is
 *  the folder itself (`"."`) is a plugin too, so the rule does not report it. `--plugin-dir` does
 *  not read `marketplace.json`, so a marketplace with another entry still gets a report. */
function isMarketplaceRoot(base: string, bound: string, value: string): boolean {
  if (value === '' || UNRESOLVED.test(value)) {
    return false
  }
  const target = path.resolve(base, value)
  // The walk of `realSource` would look at a folder above the repository to refuse it.
  if (!isInside(target, bound)) {
    return false
  }
  const real = realSource(bound, bound, bound, target)
  if (typeof real !== 'string') {
    return false
  }
  const file = path.join(real, '.claude-plugin', 'marketplace.json')
  const found = readJson(file, bound)
  return (
    found !== null &&
    found !== UNREADABLE &&
    hasManifest(real) === false &&
    !listsOnlyItself(file, real, bound)
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'marketplaceRoot' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not load a marketplace root with --plugin-dir or CLAUDE_CODE_PLUGIN_DIRS',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      marketplaceRoot:
        'The script "{{script}}" loads "{{path}}" with `{{source}}`, and that folder is a marketplace root. Claude Code does not read `marketplace.json` there, so the plugins under `plugins/` do not load, and no error shows. Point `{{source}}` at the folder of a plugin.',
    },
  },
  create(context) {
    const base = realDirectory(path.dirname(path.resolve(context.filename)))
    const bound = repositoryRoot(base)
    return {
      Document(node) {
        const scripts = lastMember(node.body, 'scripts')?.value
        for (const member of scripts?.type === 'Object' ? lastMembers(scripts.members) : []) {
          const command = member.value
          if (command.type !== 'String') {
            continue
          }
          for (const { value, source } of pluginDirs(command.value)) {
            if (isMarketplaceRoot(base, bound, value)) {
              const script = keyOf(member.name)
              context.report({
                node: command,
                messageId: 'marketplaceRoot',
                data: { script, path: value, source },
              })
            }
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/package.json'],
}

export default rule
