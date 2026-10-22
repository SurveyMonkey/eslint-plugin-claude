// The scoped names of the agents of one plugin must differ
// (docs/rules/agent-plugin-scoped-name-unique.md). The scoped name is the
// plugin name, each subfolder of `agents/`, and the `name` field or the file
// name. All files of a plugin share the plugin name, so the rule compares the
// rest. A file that the manifest key `agents` lists loses its subfolders.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  isInside,
  markdownFiles,
  readManifest,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'agent-plugin-scoped-name-unique' as const

interface Entry {
  file: string
  id: string
}

/** The scoped name of `file` without the plugin name: the subfolders, then the
 *  `name` field, or the file name when the field is not a non-empty string.
 *  The result is null when the rule cannot read the file. */
function entryOf(file: string, subfolders: string[]): Entry | null {
  const fields = frontmatterOfFile(file)
  if (fields === UNREADABLE) {
    return null
  }
  const given = fields?.name
  const base =
    typeof given === 'string' && given !== '' ? given : path.basename(file).replace(/\.md$/, '')
  return { file, id: [...subfolders, base].join(':') }
}

/** The files that the manifest value `value` of `agents` lists: `.md` files
 *  inside the plugin root `root`. `classifyLinted` gives no scope when the value
 *  is neither a path nor a list of paths. */
function listedFiles(value: unknown, root: string): string[] {
  const paths: unknown[] = Array.isArray(value) ? value : [value]
  const base = realDirectory(root)
  return paths
    .filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.md'))
    .map((entry) => path.resolve(root, entry))
    .filter((file) => {
      const real = realOf(file)
      return typeof real === 'string' && isInside(real, base)
    })
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'duplicate' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each agent of a plugin its own scoped name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate:
        'The scoped name `<plugin>:{{id}}` is also the scoped name of {{others}}. The docs do not say which of them Claude Code uses. Rename one.',
    },
  },
  create(context) {
    const scope = classifyLinted(context)
    if (scope === null || !scope.plugin) {
      return {}
    }
    const self = path.resolve(context.filename)
    const bound = repositoryRoot(scope.root)
    const manifest = readManifest(scope.root, bound)
    // `classifyLinted` gives a plugin scope only when the manifest says which files load. Then
    // `self` is in `agents/` with no key, or the key names it. A root with no manifest has no key.
    const agents = manifest === UNREADABLE || manifest === null ? undefined : manifest.agents
    const agentsDir = path.join(scope.root, 'agents')
    const sets = agents !== undefined
    // The key replaces the `agents/` scan.
    const listed = sets ? listedFiles(agents, scope.root) : null
    // The subfolders of `file` below `agents/`. A file that the key lists has none.
    const subfoldersOf = (file: string) =>
      sets ? [] : path.relative(agentsDir, path.dirname(file)).split(path.sep).filter(Boolean)
    return {
      root(node) {
        let given: unknown
        let loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
        const first = node.children[0]
        if (first?.type === 'yaml') {
          // Frontmatter that does not parse sets no field. The agent is named after its file.
          const fm = readFrontmatter(context.sourceCode, first)
          const field = fm?.fields.get('name')
          given = fm?.data.name
          if (fm !== null && field !== undefined) {
            loc = fm.at(field.valueStart, field.valueEnd)
          }
        }
        // The linted text can differ from the file on disk, so the id comes from the text.
        const id = [
          ...subfoldersOf(self),
          typeof given === 'string' && given !== ''
            ? given
            : path.basename(self).replace(/\.md$/, ''),
        ].join(':')
        const entries = (listed ?? markdownFiles(agentsDir, bound).files).map((file) =>
          entryOf(file, subfoldersOf(file)),
        )
        const others = entries.filter(
          (entry): entry is Entry => entry !== null && entry.file !== self && entry.id === id,
        )
        if (others.length > 0) {
          context.report({
            loc,
            messageId: 'duplicate',
            data: {
              id,
              others: others
                .map(
                  (entry) =>
                    `\`${path.relative(scope.root, entry.file).split(path.sep).join('/')}\``,
                )
                .join(', '),
            },
          })
        }
      },
    }
  },
}

export const target = { name, language: 'markdown' as const, files: ['**/*.md'] }

export default rule
