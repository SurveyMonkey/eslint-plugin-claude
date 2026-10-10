// A monitor with `when: "on-skill-invoke:<skill>"` starts the first time that skill
// runs (docs/rules/plugin-monitors-skill-exists.md). The rule reports a skill that the
// plugin does not have. It makes no report when it cannot list the skills of the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { pluginFileOf, whensOf } from '../plugin-commands.ts'
import { ESCAPES, lookup, MISSING, type Plugin } from '../plugin-manifest.ts'
import {
  danglingOf,
  entriesOf,
  frontmatterOfFile,
  isInside,
  markdownFiles,
  realOf,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'plugin-monitors-skill-exists' as const

const PREFIX = 'on-skill-invoke:'

/** The strings of a manifest value that names paths: a string, or each string of an array. */
const listOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter((item) => typeof item === 'string')

/** Add the names of the skill in the folder `folder` to `names`. The skill has the
 *  file `SKILL.md`. Its names are `label` and the `name` of its frontmatter. The result
 *  is `none` when the folder has no such file, and `blind` when the rule cannot see it.
 *  A dangling link is no file, and a dangling link can lead anywhere. */
function addSkill(
  plugin: Plugin,
  folder: string,
  label: unknown,
  names: Set<string>,
): 'none' | 'found' | 'blind' {
  const file = path.join(folder, 'SKILL.md')
  const real = realOf(file)
  if (real === null) {
    return danglingOf(file) === null ? 'none' : 'blind'
  }
  if (real === UNREADABLE || !isInside(real, plugin.bound)) {
    return 'blind'
  }
  const fields = frontmatterOfFile(real)
  if (fields === UNREADABLE) {
    return 'blind'
  }
  for (const known of [label, fields?.name]) {
    if (typeof known === 'string') {
      names.add(known)
    }
  }
  return 'found'
}

/** Add the skills that the path `text` gives to `names`: the folder is one skill, or
 *  it holds a folder for each skill. The result is false when the rule cannot see them.
 *  A path that is not there, and a path that leaves the plugin, give none. */
function addSkillPath(plugin: Plugin, text: string, names: Set<string>): boolean {
  const real = lookup(plugin, text)
  if (real === MISSING || real === ESCAPES) {
    return true
  }
  if (real === undefined) {
    return false
  }
  // The root of the plugin, as a skill folder, has the name of the plugin.
  const label =
    real === plugin.realRoot ? plugin.fields.name : path.basename(path.resolve(plugin.root, text))
  const own = addSkill(plugin, real, label, names)
  if (own !== 'none') {
    return own === 'found'
  }
  const entries = entriesOf(real)
  // A path that is a file lists no folder.
  if (!Array.isArray(entries)) {
    return entries === null
  }
  return entries.every(
    (entry) => addSkill(plugin, path.join(real, entry.name), entry.name, names) !== 'blind',
  )
}

/** Add the names of the commands in the default `commands/` folder. A command runs by name
 *  like a skill, and a folder adds a segment (`ops:deploy`). */
function addCommands(plugin: Plugin, names: Set<string>): boolean {
  const real = lookup(plugin, 'commands')
  if (real === MISSING || real === ESCAPES) {
    return true
  }
  if (real === undefined) {
    return false
  }
  const scan = markdownFiles(real, plugin.bound)
  for (const file of scan.files) {
    names.add(path.relative(real, file).slice(0, -'.md'.length).split(path.sep).join(':'))
  }
  return !scan.unreadable && !scan.outside
}

/** The names of the skills of `plugin`, or undefined when the rule cannot list them. The
 *  names come from the `skills/` folder, the paths of the `skills` key, the `commands/` folder,
 *  and the object form of the `commands` key. A `commands` key of paths is not listed. */
function skillNames(plugin: Plugin): Set<string> | undefined {
  const names = new Set<string>()
  const { commands, skills } = plugin.fields
  // A `SKILL.md` at the plugin root loads as one skill when no `skills/` folder and no `skills` key
  // exist. The rule counts it always, which can only make the rule report less.
  const root = addSkill(plugin, plugin.realRoot, plugin.fields.name, names) !== 'blind'
  const listed =
    root && ['skills', ...listOf(skills)].every((text) => addSkillPath(plugin, text, names))
  const object = commands !== null && typeof commands === 'object' && !Array.isArray(commands)
  if (object) {
    for (const key of Object.keys(commands)) {
      names.add(key)
    }
  }
  const mapped = commands === undefined || object
  return listed && mapped && addCommands(plugin, names) ? names : undefined
}

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name a skill of the plugin in a monitor that starts when a skill runs',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The monitor starts when the skill "{{skill}}" runs, but the plugin has no such skill. The monitor never starts. Name a skill of this plugin.',
    },
  },
  create(context) {
    const file = pluginFileOf(context.filename)
    return {
      Document(node) {
        if (file === undefined) {
          return
        }
        const { plugin } = file
        const triggers = whensOf(file.role, node, plugin).filter((when) =>
          when.value.startsWith(PREFIX),
        )
        // Read the skills once, and only for a trigger that needs them.
        const names = triggers.length > 0 ? skillNames(plugin) : undefined
        const own = plugin.fields.name
        const prefix = typeof own === 'string' ? `${own}:` : undefined
        for (const when of triggers) {
          const given = when.value.slice(PREFIX.length)
          // A name can have the name of the plugin in front, as in `/plugin:skill`.
          const skill =
            prefix !== undefined && given.startsWith(prefix) ? given.slice(prefix.length) : given
          if (names !== undefined && !names.has(skill) && !names.has(given)) {
            context.report({ node: when, messageId: 'missing', data: { skill } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json', '**/monitors/monitors.json'],
  rule,
}
