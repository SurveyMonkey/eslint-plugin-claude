// The rule reports each Markdown and JSON file under `.claude/teams/`. ESLint
// lints only the file types that a language reads, so a `.yaml` or `.txt` file
// gets no report.
import { jsonTester, markdownTester, ruleOf } from '../rule-tester.test-support.ts'

const rule = ruleOf('agent-teams-no-project-config')
const report = { messageId: 'noProjectConfig', line: 1, column: 1 }

jsonTester.run('agent-teams-no-project-config (json)', rule, {
  valid: [],
  invalid: [
    {
      code: '{ "members": [] }',
      filename: '.claude/teams/teams.json',
      errors: [report],
    },
    {
      code: '{}',
      filename: 'packages/x/.claude/teams/review/config.json',
      errors: [report],
    },
  ],
})

markdownTester.run('agent-teams-no-project-config (markdown)', rule, {
  valid: [],
  invalid: [
    {
      code: '# Team\n',
      filename: '.claude/teams/review.md',
      errors: [report],
    },
    {
      code: '',
      filename: '.claude/teams/empty.md',
      errors: [report],
    },
  ],
})
