// A rule run through `Linter` with the real plugin, for a test that needs a
// rule option or a file on disk. `RuleTester` takes options, but not a file
// that the rule reads from disk.
import path from 'node:path'
import markdown from '@eslint/markdown'
import { Linter } from 'eslint'
import plugin from '../src/index.ts'

/** The messages of the rule `name`, set to `warn` with `options`, for `code`
 *  at the absolute path `filename`. */
export function lintRule(name: string, options: unknown[], code: string, filename: string) {
  return new Linter({ cwd: path.parse(filename).root }).verify(
    code,
    [
      {
        files: ['**/*.md'],
        plugins: { markdown, claude: plugin },
        language: 'markdown/gfm',
        languageOptions: { frontmatter: 'yaml' },
        rules: { [`claude/${name}`]: ['warn', ...options] },
      },
    ],
    { filename },
  )
}

/** The frontmatter and body of an agent file with the extra fields `fields`. */
export const agentText = (fields: string, name = 'a') =>
  `---\nname: ${name}\ndescription: d\n${fields}---\n\nBody.\n`
