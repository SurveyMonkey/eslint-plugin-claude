import { readFileSync } from 'node:fs'
import { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}

const SKILL = `---\nname: s\ndescription: ${'a'.repeat(1025)}\n---\n`

describe('plugin', () => {
  it('reports the name and version from package.json', () => {
    expect(plugin.meta).toEqual({ name: pkg.name, version: pkg.version, namespace: 'claude' })
  })

  it('has exactly the recommended and strict configs', () => {
    expect(Object.keys(plugin.configs)).toEqual(['recommended', 'strict'])
  })

  it('registers itself in each block of each config under its namespace', () => {
    for (const block of [...plugin.configs.recommended, ...plugin.configs.strict]) {
      expect(block.plugins?.claude).toBe(plugin)
    }
  })

  for (const config of ['recommended', 'strict'] as const) {
    it(`loads the ${config} config by name through extends`, () => {
      const linter = new Linter()
      const viaName = defineConfig([{ plugins: { claude: plugin }, extends: [`claude/${config}`] }])
      const messages = linter.verify(SKILL, viaName, '.claude/skills/s/SKILL.md')
      expect(messages.map((m) => [m.ruleId, m.severity])).toEqual([
        ['claude/skill-description-max-length', 1],
      ])
    })
  }

  // No optional chaining on purpose. `pnpm typecheck` covers tests/, so this
  // fails if the public type makes a config key or `meta` optional.
  it('loads each config object through extends and defineConfig', () => {
    const linter = new Linter()
    for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
      const viaExtends = defineConfig([{ extends: [config] }])
      const viaSpread = defineConfig([...config])
      for (const loaded of [viaExtends, viaSpread]) {
        const messages = linter.verify(SKILL, loaded, '.claude/skills/s/SKILL.md')
        expect(messages.map((m) => m.ruleId)).toEqual(['claude/skill-description-max-length'])
      }
    }
    expect(plugin.meta.name).toBe(pkg.name)
  })
})
