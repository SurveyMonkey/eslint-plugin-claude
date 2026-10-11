// Fixtures for the tests of the hooks rules. The shapes are those of the hooks reference
// (https://code.claude.com/docs/en/hooks#configuration): an event holds matcher groups, and
// a group holds handlers.
import json from '@eslint/json'
import { Linter } from 'eslint'
import plugin from '../src/index.ts'
import { lintJson, lintMarkdown } from './rule-tester.test-support.ts'

/** The files that a hooks rule reads, with a fake root. `lintJson` and `lintMarkdown` take the
 *  path as it is, so a case names the kind of file. */
export const FILES = {
  project: '/repo/.claude/settings.json',
  local: '/repo/.claude/settings.local.json',
  managed: '/repo/managed-settings.json',
  dropIn: '/repo/managed-settings.d/10-a.json',
  hidden: '/repo/managed-settings.d/.10-a.json',
  plugin: '/repo/plugins/p/hooks/hooks.json',
  skill: '/repo/.claude/skills/s/SKILL.md',
  agent: '/repo/.claude/agents/a.md',
}

/** The settings files that carry the `hooks` key. */
export const SETTINGS = [FILES.project, FILES.local, FILES.managed, FILES.dropIn]

/** A command handler with the fields `fields`. */
export const command = (fields: Record<string, unknown> = {}) => ({
  type: 'command',
  command: './check.sh',
  ...fields,
})

/** A hooks object with one event, one matcher group and the handlers `handlers`. */
export const hooks = (event: string, handlers: unknown[], matcher?: unknown) => ({
  [event]: [{ ...(matcher === undefined ? {} : { matcher }), hooks: handlers }],
})

/** The text of a settings file or a plugin hooks file that holds `value` as `hooks`. */
export const settings = (value: unknown) => JSON.stringify({ hooks: value })

/** The text of a skill or agent file that holds the YAML `yaml` under `hooks:`. */
export const frontmatter = (yaml: string) =>
  `---\nname: s\ndescription: d\nhooks:\n${yaml
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n')}---\n\nBody.\n`

/** The message ids of the rule `name` for the JSON text `code` at `file`. */
export const jsonIds = (name: string, code: string, file: string) =>
  lintJson(name, code, file).map((message) => message.messageId)

/** The message ids of the rule `name` for the Markdown text `code` at `file`. */
export const markdownIds = (name: string, code: string, file: string) =>
  lintMarkdown(name, code, file).map((message) => message.messageId)

/** The messages of the rule `name` for the JSON5 text `code`. Only JSON5 has `NaN`. */
export function lintJson5(name: string, code: string, file: string) {
  return new Linter({ cwd: '/' }).verify(
    code,
    [
      {
        files: ['**/*.json'],
        plugins: { json, claude: plugin },
        language: 'json/json5',
        rules: { [`claude/${name}`]: 'error' },
      },
    ],
    { filename: file },
  )
}
