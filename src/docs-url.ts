// The page that an editor opens from a report. Each rule has one doc under
// `docs/rules/`, and a test checks that the doc exists.
const DOCS = 'https://github.com/SurveyMonkey/eslint-plugin-claude/blob/main/docs/rules'

/** The URL of the doc for the rule `name`. */
export function docsUrl(name: string): string {
  return `${DOCS}/${name}.md`
}
