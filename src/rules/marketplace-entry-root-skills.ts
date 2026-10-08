// An entry in `marketplace.json` whose source is the marketplace root and that
// lists `skills` must list every skill directory under the default `skills/`.
// Claude Code loads the listed ones only and does not scan `skills/`
// (docs/rules/marketplace-entry-root-skills.md). The rule reads the directory
// `skills/` inside the marketplace root, and makes no report when it cannot
// read it.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries, type ValueNode } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'
import { isInside, realOf, skillFiles } from '../skill-tree.ts'
import { pathFault } from './marketplace-relative-source-format.ts'

const name = 'marketplace-entry-root-skills' as const

// The result of `listed` for a value that lists every skill.
const ALL: unique symbol = Symbol('all')

// A path that lists one skill directory below the default `skills/`.
const SKILL_DIRECTORY = /^skills\/([^/]+)$/

/** The skill directories that the `skills` value lists, by name. The result is
 *  undefined when the rule cannot read the value, and `ALL` when the value
 *  lists the default `skills/` directory or the plugin root, which hold every
 *  skill. A value is readable when it is a string or an array of strings, and
 *  each string is `.` or a path that starts with `./`, with no `..`, no
 *  backslash and no network form. An empty array is not read: the docs do
 *  not say what it does. Other values are for
 *  `marketplace-entry-component-paths` and `marketplace-schema`. */
function listed(value: ValueNode): Set<string> | typeof ALL | undefined {
  const items = value.type === 'Array' ? value.elements.map((element) => element.value) : [value]
  if (items.length === 0) {
    return undefined
  }
  const names = new Set<string>()
  for (const item of items) {
    if (item.type !== 'String') {
      return undefined
    }
    const text = item.value
    const rooted = text === '.' || text.startsWith('./')
    if (!rooted || pathFault(text) !== undefined || text.includes('\\')) {
      return undefined
    }
    const normal = path.posix.normalize(text).replace(/\/$/, '')
    if (normal === '.' || normal === 'skills') {
      return ALL
    }
    const skill = SKILL_DIRECTORY.exec(normal)?.[1]
    if (skill !== undefined) {
      names.add(skill)
    }
  }
  return names
}

const rule: JSONRuleDefinition<{ MessageIds: 'omitted' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'List every skill directory in the skills of an entry whose source is the marketplace root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      omitted:
        'The entry lists "skills" and its source is the marketplace root, so Claude Code loads the listed skills only. It does not load these skills under skills/: {{names}}. List each skill.',
    },
  },
  create(context) {
    // The marketplace root is the directory that holds `.claude-plugin/`.
    const root = path.dirname(path.dirname(path.resolve(context.filename)))
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          const member = lastMember(entry, 'skills')
          if (member === undefined) {
            continue
          }
          const names = listed(member.value)
          if (names === undefined || names === ALL) {
            continue
          }
          const source = read(entry)
          // Only a source with a directory is read. The reader gives the real path of that directory,
          // and the root is the source when the two are equal.
          if (!('dir' in source) || source.dir !== realOf(root)) {
            continue
          }
          // The skills directory is read when its real path is inside the marketplace root.
          const skillsDir = realOf(path.join(source.dir, 'skills'))
          if (typeof skillsDir !== 'string' || !isInside(skillsDir, source.dir)) {
            continue
          }
          const omitted = skillFiles(skillsDir, source.dir)
            .map((file) => path.basename(path.dirname(file)))
            .filter((skill) => !names.has(skill))
          if (omitted.length > 0) {
            const data = { names: omitted.map((skill) => `"${skill}"`).join(', ') }
            context.report({ node: member, messageId: 'omitted', data })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}
