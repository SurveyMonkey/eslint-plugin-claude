// A plugin on disk, for a rule test that needs the plugin-root check of
// ADR 001, Decision 10. The check reads `.claude-plugin/plugin.json`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll } from 'vitest'

const scratch = mkdtempSync(path.join(tmpdir(), 'plugin-fixture-'))

// The root of a plugin that holds a manifest.
const pluginDir = path.join(scratch, 'plugins', 'p')
mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true })
writeFileSync(path.join(pluginDir, '.claude-plugin', 'plugin.json'), '{}')

afterAll(() => rmSync(scratch, { recursive: true, force: true }))

/** The path of the command file `name` in the plugin. */
export const pluginCommand = (name = 'c') => path.join(pluginDir, 'commands', `${name}.md`)

/** The path of the `SKILL.md` of the skill `folder` in the plugin. */
export const pluginSkill = (folder = 's') => path.join(pluginDir, 'skills', folder, 'SKILL.md')

/** The path of the agent file `name` in the plugin, at `agents/<name>.md`. */
export const pluginAgent = (name = 'a') => path.join(pluginDir, 'agents', `${name}.md`)

/** The path of the output style file `name` in the plugin. */
export const pluginStyle = (name = 's') => path.join(pluginDir, 'output-styles', `${name}.md`)
