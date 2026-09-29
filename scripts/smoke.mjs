// Runs against the packed tarball, installed into an empty directory, so it
// sees what npm consumers get. See the `test` job in .github/workflows/ci.yml.
import assert from 'node:assert/strict'
import { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import plugin from 'eslint-plugin-claude'

assert.equal(plugin.meta.name, 'eslint-plugin-claude')
assert.equal(plugin.meta.namespace, 'claude')
assert.equal(plugin.configs.recommended[0].plugins.claude, plugin)

const config = defineConfig([
  { files: ['**/*.js'], plugins: { claude: plugin }, extends: ['claude/recommended'] },
])
assert.deepEqual(new Linter().verify('const a = 1\n', config, 'a.js'), [])

console.log(`smoke: ${plugin.meta.name}@${plugin.meta.version} loads in ESLint`)
