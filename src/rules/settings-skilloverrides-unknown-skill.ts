// A `skillOverrides` key that names no skill the repository can show
// (docs/rules/settings-skilloverrides-unknown-skill.md). A heuristic, and `off` in `recommended`.
// The bundled skills are in `src/data/skill-fields.ts`, and their aliases in
// `src/data/settings-keys.ts`. The rule reads the `.claude/skills/` and `.claude/commands/`
// folders of the project. The option `allow` lists the user skills that a repository cannot show.
// A key with a colon names a plugin skill, a nested skill or a command in a subfolder, and the
// rule does not look it up. `settings-skilloverrides-key` reports an alias in a project file, so
// the rule accepts an alias. The rule does not check a managed file, as it cannot see the
// projects that the file applies to.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { BUNDLED_SKILL_ALIASES } from '../data/settings-keys.ts'
import { BUNDLED_SKILLS } from '../data/skill-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { skillNames } from '../project-names.ts'

const name = 'settings-skilloverrides-unknown-skill' as const

type Options = [{ allow: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'unknown' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Key skillOverrides by the name of a skill that the repository or Claude Code has',
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
        '"{{key}}" is not a bundled skill, and no skill or command in .claude/ has that name, so this entry has no effect. If the skill is a user skill, name it in the option "allow".',
    },
  },
  create(context) {
    const [{ allow }] = context.options
    return {
      Document(node) {
        const overrides = lastMember(node.body, 'skillOverrides')?.value
        if (overrides?.type !== 'Object') {
          return
        }
        // The scan is lazy: a file with no entry to judge reads nothing.
        let found: ReturnType<typeof skillNames> | undefined
        for (const member of overrides.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`. A `null` value removes it.
          if (lastMember(overrides, key) !== member || member.value.type === 'Null') {
            continue
          }
          const same = (other: string) => other.toLowerCase() === key.toLowerCase()
          if (
            key.includes(':') ||
            BUNDLED_SKILLS.some(same) ||
            BUNDLED_SKILL_ALIASES.has(key) ||
            allow.some(same)
          ) {
            continue
          }
          found ??= skillNames(path.dirname(path.resolve(context.filename)))
          // A path that the rule cannot read can hold the skill.
          if (!found.unseen && !found.names.some(same)) {
            context.report({ node: member.name, messageId: 'unknown', data: { key } })
          }
        }
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
