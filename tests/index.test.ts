import { readFileSync } from 'node:fs'
import { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.ts'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}

describe('plugin', () => {
  it('reports the name and version from package.json', () => {
    expect(plugin.meta).toEqual({ name: pkg.name, version: pkg.version, namespace: 'claude' })
  })

  it('registers itself in the recommended config under its namespace', () => {
    expect(plugin.configs.recommended?.[0]?.plugins?.claude).toBe(plugin)
  })

  it('loads the recommended config by name through extends', () => {
    const linter = new Linter()
    const config = defineConfig([
      { files: ['**/*.js'], plugins: { claude: plugin }, extends: ['claude/recommended'] },
    ])
    expect(linter.verify('const a = 1\n', config, 'a.js')).toEqual([])
  })
})
