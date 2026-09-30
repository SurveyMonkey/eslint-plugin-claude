// Runs against the packed tarball, installed into an empty directory with its
// peers, so it sees what npm consumers get. See the `test` job in
// .github/workflows/ci.yml.
import assert from 'node:assert/strict'
import { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import plugin from 'eslint-plugin-claude'

assert.equal(plugin.meta.name, 'eslint-plugin-claude')
assert.equal(plugin.meta.namespace, 'claude')
assert.deepEqual(Object.keys(plugin.configs), ['recommended', 'strict'])

const SKILL = `---\nname: s\ndescription: ${'a'.repeat(1025)}\n---\n`
const HOOKS = JSON.stringify({ hooks: { Bogus: [] } })

// One Markdown file and one JSON file, each with one report. 1 is warn, 2 is
// error. `strict` has the same severities as `recommended` today.
const FILES = [
  ['.claude/skills/s/SKILL.md', SKILL, ['claude/skill-description-max-length', 1]],
  ['hooks/hooks.json', HOOKS, ['claude/hooks-event-name-known', 2]],
]

for (const name of ['recommended', 'strict']) {
  const linter = new Linter()
  const config = defineConfig([{ plugins: { claude: plugin }, extends: [`claude/${name}`] }])
  for (const [file, code, expected] of FILES) {
    const messages = linter.verify(code, config, file)
    assert.deepEqual(
      messages.map((m) => [m.ruleId, m.severity]),
      [expected],
      `${name}: ${file}`,
    )
  }
}

console.log(`smoke: ${plugin.meta.name}@${plugin.meta.version} lints Markdown and JSON in ESLint`)
