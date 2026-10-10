// The plugin components page: a plugin output style is a style file "with
// `name` and `description` frontmatter".
import { describe, expect, it } from 'vitest'
import { repo } from '../agent-settings.test-support.ts'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const lint = (code: string, at = 'output-styles/s.md') =>
  lintMarkdown(
    'output-style-plugin-name-description',
    code,
    `${repo({ '.claude-plugin/plugin.json': '{}' })}/${at}`,
  )

describe('output-style-plugin-name-description', () => {
  it.fails('reports a plugin style with no name', () => {
    expect(lint('---\ndescription: d\n---\n\nBody.\n')).toMatchObject([{ messageId: 'missing' }])
  })

  it.fails('stays silent for a style with both fields', () => {
    expect(lint('---\nname: s\ndescription: d\n---\n\nBody.\n')).toEqual([])
  })
})
