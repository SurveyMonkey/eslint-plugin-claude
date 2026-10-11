// The eval format lists of `src/data/plugin-layout.ts` against literal copies of the tables of the
// plugin evals page, "Eval suite reference" (https://code.claude.com/docs/en/plugin-evals#eval-suite-reference),
// checked on Claude Code 2.1.296 on 2026-10-10. The rule tests loop over these constants, so a
// wrong entry would pass them. The tests of `tests/plugin-layout.test.ts` pin the lists by hand. These
// tests read the rows of the docs, so a copy error in one place does not hide in the other.
import { describe, expect, it } from 'vitest'
import {
  EVAL_CASE_SCHEMA_VERSION,
  EVAL_ENV_KEY,
  EVAL_GRADER_ARMS,
  EVAL_GRADER_TARGETS,
  EVAL_GRADER_TYPES,
  EVAL_MOCK_TYPES,
  EVAL_PROMPT_FIELDS,
  EVAL_PROMPT_LIMITS,
} from '../src/data/plugin-layout.ts'

// The "prompt.md frontmatter" table: the first two columns of each row, and the purpose cut short.
const PROMPT_MD_TABLE = `
| \`schema_version\` | \`"1.1"\`, set for you | Case format version. |
| \`name\` | The directory name | Case name. |
| \`description\` | | For humans. Not used at run time |
| \`tags\` | \`[]\` | Labels for \`--tag\` filtering. |
| \`plugins\` | The nearest enclosing plugin | Plugin directories under test. |
| \`runs\` | \`3\` | Runs per arm, 1 to 50. \`--runs\` overrides it |
| \`expected_outcome\` | | For humans. Not used at run time |
| \`model\` | The child session's default | Model for the agent under test. |
| \`max_turns\` | \`10\` | Turn cap, up to 200. Hitting it is recorded as a run error. |
| \`timeout_seconds\` | \`300\` | Wall-clock cap per run, up to 3600 |
| \`allowed_tools\` | \`[]\` | Tools the case wants. |
| \`append_system_prompt\` | | Text appended to the child session's system prompt |
| \`env\` | \`{}\` | Extra environment variables for the child session. Keys must match \`EVAL_[A-Z0-9_]*\`; any other key fails the run. |
`

// The "Grader types" table: the first column of each row.
const GRADER_TYPES_TABLE = `
| \`regex\` | \`pattern\`, \`flags\`, \`match\`, \`target\` | The JavaScript regex. |
| \`tool_used\` | \`tool\`, \`input_match\`, \`min\`, \`max\` | The number of calls. |
| \`tool_order\` | \`before\`, \`after\` | Both tools were called. |
| \`file_exists\` | \`path\`, \`exists\` | A file Claude created matches. |
| \`llm\` | \`criteria\`, \`focus\` | A judge model votes PASS. |
| \`baseline\` | \`baseline_file\`, \`criteria\` | A judge finds the run satisfies the criteria. |
`

// The "What a grader can look at" table: the first column of each row. The fourth row is a map.
const TARGETS_TABLE = `
| \`last_message\` | Claude's final response text. This is the default |
| \`trace\` | The session as JSON, one message per line. |
| \`files\` | The list of paths Claude created during the run, one per line. |
| \`{ source: file, path: <path> }\` | The contents of one file in the workspace after the run. |
| \`mock_calls\` | Each call Claude made to a mocked MCP tool. |
`

// The "Grader frontmatter" row for \`arm\`, and the "Mock files" row for \`type\`.
const ARM_ROW =
  '| `arm` | unset | `with-only` excludes the grader from scoring in a two-arm run; `both` forces a grader Claude Code would otherwise exclude to be scored in both arms |'
const MOCK_TYPE_ROW =
  '| `type` | `fixed` | `fixed` returns the body as written. `agent` treats the body as instructions for the judge model |'

/** The text of the first backtick span of each row of `table`. */
function firstColumn(table: string): string[] {
  return table
    .trim()
    .split('\n')
    .map((row) => /^\| `([^`]+)`/.exec(row)?.[1] ?? '')
}

/** The text of the code spans in `row`, after its second cell. */
function spansAfterSecondCell(row: string): string[] {
  const cells = row.split(' | ')
  return [...(cells[2] ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1] as string)
}

describe('the eval format lists against the docs', () => {
  it('lists the fields of prompt.md as the table does', () => {
    expect(EVAL_PROMPT_FIELDS).toEqual(firstColumn(PROMPT_MD_TABLE))
  })

  it('takes the limits of prompt.md from the purpose column', () => {
    expect(PROMPT_MD_TABLE).toContain('Runs per arm, 1 to 50.')
    expect(PROMPT_MD_TABLE).toContain('Turn cap, up to 200.')
    expect(PROMPT_MD_TABLE).toContain('Wall-clock cap per run, up to 3600')
    expect([...EVAL_PROMPT_LIMITS]).toEqual([
      ['runs', { min: 1, max: 50 }],
      ['max_turns', { max: 200 }],
      ['timeout_seconds', { max: 3600 }],
    ])
  })

  it('takes the env key pattern and the case version from the docs text', () => {
    expect(PROMPT_MD_TABLE).toContain('Keys must match `EVAL_[A-Z0-9_]*`')
    expect(EVAL_ENV_KEY.source).toBe('^EVAL_[A-Z0-9_]*$')
    expect(PROMPT_MD_TABLE).toContain('`"1.1"`')
    expect(EVAL_CASE_SCHEMA_VERSION).toBe('1.1')
  })

  it('lists the grader types as the table does', () => {
    expect(EVAL_GRADER_TYPES).toEqual(firstColumn(GRADER_TYPES_TABLE))
  })

  it('lists the string values of target and focus, and not the map form', () => {
    const rows = firstColumn(TARGETS_TABLE)
    expect(EVAL_GRADER_TARGETS).toEqual(rows.filter((row) => !row.startsWith('{')))
    expect(rows).toContain('{ source: file, path: <path> }')
  })

  it('lists the arms that the arm row names', () => {
    expect(EVAL_GRADER_ARMS).toEqual(spansAfterSecondCell(ARM_ROW).slice(0, 2))
  })

  it('lists the mock types that the type row names', () => {
    expect(EVAL_MOCK_TYPES).toEqual(spansAfterSecondCell(MOCK_TYPE_ROW).slice(0, 2))
  })
})
