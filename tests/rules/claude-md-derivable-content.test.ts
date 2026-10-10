// The docs list what to leave out of a CLAUDE.md: anything Claude can work out by reading the
// code, and file-by-file descriptions of the code base
// (https://code.claude.com/docs/en/memory#my-claude-md-is-too-large). The rule is a heuristic
// for three shapes: a directory tree in a code block, a list of dependencies in a code block,
// and a list that describes files one by one. The globs are in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintMarkdown } from '../rule-tester.test-support.ts'

const RULE = 'claude-md-derivable-content'

/** The messages for `code` as the file `file`. */
function lint(code: string, file = '/repo/CLAUDE.md') {
  return lintMarkdown(RULE, code, file)
}

const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

const TREE = '```\nsrc/\n├── index.ts\n├── rules/\n│   └── a.ts\n└── data/\n```\n'

describe(RULE, () => {
  it('reports a directory tree in a fenced block, over the whole block', () => {
    const messages = lint(`# Layout\n\n${TREE}`)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'tree',
      line: 3,
      column: 1,
      endLine: 9,
      endColumn: 4,
    })
    expect(messages[0]?.message).toBe(
      'Claude can work out this directory tree from the code. Cut it, or keep only the folders whose use their names do not show.',
    )
  })

  it('reports a tree with plain characters, in a block with or without a language', () => {
    expect(ids(lint('```text\nsrc\n|-- a.ts\n|-- b.ts\n`-- c.ts\n```\n'))).toEqual(['tree'])
    expect(ids(lint('~~~\nsrc\n+-- a.ts\n+-- b.ts\n\\-- c.ts\n~~~\n'))).toEqual(['tree'])
    expect(ids(lint('    src\n    ├── a.ts\n    ├── b.ts\n    └── c.ts\n'))).toEqual(['tree'])
  })

  it('stays silent on a block with fewer than three branches, and on other blocks', () => {
    expect(lint('```\nsrc\n├── a.ts\n└── b.ts\n```\n')).toEqual([])
    expect(lint('```bash\npnpm install\npnpm test\n```\n')).toEqual([])
    expect(lint('```\nsrc/a.ts\nsrc/b.ts\nsrc/c.ts\n```\n')).toEqual([])
  })

  it('stays silent on a tree outside a code block', () => {
    expect(lint('├── a.ts\n├── b.ts\n└── c.ts\n')).toEqual([])
    expect(lint('<!--\n├── a.ts\n├── b.ts\n└── c.ts\n-->\n')).toEqual([])
  })

  it('reports a list of dependencies in a code block', () => {
    for (const text of [
      '```json\n{\n  "dependencies": {\n    "react": "^18.2.0"\n  }\n}\n```\n',
      '```json\n  "devDependencies": {\n    "vitest": "^5.0.0"\n  }\n```\n',
      '```toml\n[dependencies]\nserde = "1"\n```\n',
      '```toml\n[tool.poetry.dependencies]\nrequests = "^2"\n```\n',
      '```\nflask==3.0.0\nrequests==2.31.0\nclick>=8.1\n```\n',
    ]) {
      const messages = lint(text)
      expect(ids(messages), text).toEqual(['dependencies'])
    }
    expect(lint('```json\n"dependencies": {}\n```\n')[0]?.message).toBe(
      'Claude can read the dependencies from the manifest file. Cut this list.',
    )
  })

  it('stays silent on a block with one pinned line, or on the word in prose', () => {
    expect(lint('```\nflask==3.0.0\nrun it\n```\n')).toEqual([])
    expect(lint('```json\n{ "name": "a", "scripts": {} }\n```\n')).toEqual([])
    expect(lint('Install the dependencies with pnpm.\n')).toEqual([])
    expect(lint('Use `"dependencies"` only for runtime code.\n')).toEqual([])
  })

  it('reports a list that describes files one by one, over the whole list', () => {
    const list =
      '- `src/index.ts`: the entry point\n- `src/rules/`: the rules\n- `package.json` - the manifest\n'
    const messages = lint(`## Files\n\n${list}`)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      messageId: 'fileList',
      line: 3,
      column: 1,
      endLine: 5,
      endColumn: 32,
    })
    expect(messages[0]?.message).toBe(
      'This list describes the code file by file. Claude can read each file. Cut it, or keep only what the code does not show.',
    )
    expect(ids(lint('* `a.ts`: one\n* `b.ts`: two\n* `c.ts` is three\n'))).toEqual(['fileList'])
    // A dash with a space after it separates the path from the text, whatever the dash is.
    expect(ids(lint('- `a.ts` \u2013 one\n- `b.ts` \u2014 two\n- `c.ts` - three\n'))).toEqual([
      'fileList',
    ])
    expect(lint('- `a.ts` -one\n- `b.ts` -two\n- `c.ts` -three\n')).toEqual([])
  })

  it('stays silent on a short list, a list of other items and one that mixes shapes', () => {
    expect(lint('- `src/index.ts`: the entry point\n- `src/rules/`: the rules\n')).toEqual([])
    expect(
      lint('- `pnpm test`: run the tests\n- `pnpm lint`: run the linter\n- `pnpm build`: build\n'),
    ).toEqual([])
    expect(lint('- Use `src/index.ts` as the entry point\n- a\n- b\n- c\n')).toEqual([])
    expect(
      lint('- `src/a.ts`: one\n- `src/b.ts`: two\n- note\n- `src/c.ts`: three\n- more\n'),
    ).toEqual([])
    // An item with no text, and an item that starts with a code block.
    expect(lint('-\n- `src/a.ts`: one\n- `src/b.ts`: two\n')).toEqual([])
    expect(lint('- ```\n  x\n  ```\n- `src/a.ts`: one\n- `src/b.ts`: two\n')).toEqual([])
    expect(lint('```\n- `src/a.ts`: one\n- `src/b.ts`: two\n- `src/c.ts`: three\n```\n')).toEqual(
      [],
    )
  })

  it('checks a CLAUDE.md and a CLAUDE.local.md, and no other file', () => {
    for (const file of ['/repo/CLAUDE.md', '/repo/.claude/CLAUDE.md', '/repo/CLAUDE.local.md']) {
      expect(ids(lint(TREE, file)), file).toEqual(['tree'])
    }
    for (const file of [
      '/repo/.claude/rules/a.md',
      '/repo/.claude/rules/CLAUDE.md',
      '/repo/docs/a.md',
    ]) {
      expect(lint(TREE, file), file).toEqual([])
    }
  })
})
