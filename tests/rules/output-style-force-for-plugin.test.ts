// The output styles page, "Frontmatter reference": `force-for-plugin: true`
// applies the style whenever the plugin is enabled and overrides the
// `outputStyle` setting of the user.
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (code: string, at = 'output-styles/s.md') =>
  lintMarkdown(
    'output-style-force-for-plugin',
    code,
    `${repo({ '.claude-plugin/plugin.json': '{}' })}/${at}`,
  )

describe('output-style-force-for-plugin', () => {
  it.fails('reports force-for-plugin: true in a plugin style', () => {
    expect(lint('---\nforce-for-plugin: true\n---\n')).toMatchObject([
      { messageId: 'forced', line: 2, column: 20, endColumn: 24 },
    ])
  })

  it.fails('stays silent for force-for-plugin: false', () => {
    expect(lint('---\nforce-for-plugin: false\n---\n')).toEqual([])
  })
})
