// A repository on disk for a rule that compares a local agent with the
// committed settings. The rule module is the test subject, so the test needs
// no entry in the plugin list.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import markdown from '@eslint/markdown'
import { Linter, type Rule } from 'eslint'
import { afterAll } from 'vitest'

const scratch = realpathSync(mkdtempSync(path.join(tmpdir(), 'agent-settings-')))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

let count = 0
/** A fresh repository with a `.git` directory and the files `files`, each
 *  keyed by its path in the repository. The result is the repository root. */
export function repo(files: Record<string, string>) {
  const root = path.join(scratch, `repo${count++}`)
  mkdirSync(path.join(root, '.git'), { recursive: true })
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

/** The frontmatter and body of an agent file with the extra fields `fields`. */
export const agent = (fields: string, name = 'a') =>
  `---\nname: ${name}\ndescription: d\n${fields}---\n\nBody.\n`

/** The messages of the rule `module` for `code` at `filename`. */
export function lintWith(module: { name: string; rule: unknown }, code: string, filename: string) {
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: {
          markdown,
          claude: { rules: { [module.name]: module.rule as Rule.RuleModule } },
        },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { [`claude/${module.name}`]: 'error' },
      },
    ],
    { filename },
  )
}
