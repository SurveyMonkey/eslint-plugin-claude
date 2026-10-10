// The tool names that a permission rule can name. Source: the tools table of
// the tools reference (https://code.claude.com/docs/en/tools-reference#tools-reference)
// and its rule format table
// (https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks),
// checked on Claude Code 2.1.287. Review this file, with the subagent lists
// below, on or before 2027-03-29, the `stale_after` date of
// docs/rules-inventory.md. The names are case-sensitive.

/** The built-in tools, from the "Tool" column of the tools table. */
export const TOOL_NAMES: readonly string[] = [
  'Agent',
  'Artifact',
  'AskUserQuestion',
  'Bash',
  'CronCreate',
  'CronDelete',
  'CronList',
  'Edit',
  'EndConversation',
  'EnterPlanMode',
  'EnterWorktree',
  'ExitPlanMode',
  'ExitWorktree',
  'Glob',
  'Grep',
  'ListAgents',
  'ListMcpResourcesTool',
  'LSP',
  'Monitor',
  'NotebookEdit',
  'PowerShell',
  'PushNotification',
  'Read',
  'ReadMcpResourceTool',
  'RemoteTrigger',
  'ReportFindings',
  'ScheduleWakeup',
  'SendFeedback',
  'SendMessage',
  'SendUserFile',
  'ShareOnboardingGuide',
  'Skill',
  'SubagentHandback',
  'TaskCreate',
  'TaskGet',
  'TaskList',
  'TaskOutput',
  'TaskStop',
  'TaskUpdate',
  'TodoWrite',
  'ToolSearch',
  'WaitForMcpServers',
  'WebFetch',
  'WebSearch',
  'Workflow',
  'Write',
]

/** Names that a rule can hold, and that are not in the tools table. `Task` is
 *  the old name of `Agent`. `MultiEdit` is a legacy tool. `Cd` is the rule
 *  name of the `/cd` command. Sources: the note on the `Task` rename in the
 *  subagents page
 *  (https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned), the
 *  "Read and Edit" section
 *  (https://code.claude.com/docs/en/permissions#read-and-edit) and the "Cd"
 *  section (https://code.claude.com/docs/en/permissions#cd). */
export const OTHER_RULE_TOOL_NAMES: readonly string[] = ['Task', 'MultiEdit', 'Cd']

/** The tools that the "Applies to" column of the rule format table lists,
 *  with `Cd` and `Task`. Each takes a specifier. A tool in `TOOL_NAMES` that
 *  is not here takes the bare name only. `WebSearch` is in the table, and its
 *  row says "No specifier", so it is not here. */
export const SPECIFIER_TOOLS: readonly string[] = [
  'Bash',
  'Monitor',
  'PowerShell',
  'Read',
  'Grep',
  'Glob',
  'LSP',
  'Edit',
  'Write',
  'NotebookEdit',
  'Skill',
  'Agent',
  'Task',
  'WebFetch',
  'Cd',
]

/** The tools whose path rule Claude Code accepts and never consults, each with
 *  the tool whose rule it reads instead. Source: the "Is not matched by file
 *  permission checks" warning
 *  (https://code.claude.com/docs/en/errors#is-not-matched-by-file-permission-checks). */
export const PATH_RULE_REPLACEMENT: ReadonlyMap<string, 'Edit' | 'Read'> = new Map([
  ['Write', 'Edit'],
  ['NotebookEdit', 'Edit'],
  ['MultiEdit', 'Edit'],
  ['Glob', 'Read'],
])

/** The primary input field of a tool. A `Tool(field:value)` rule cannot match
 *  it. Source: the "Match by input parameter" section
 *  (https://code.claude.com/docs/en/permissions#match-by-input-parameter). */
export const PRIMARY_FIELDS: ReadonlyMap<string, string> = new Map([
  ['Bash', 'command'],
  ['PowerShell', 'command'],
  ['Read', 'file_path'],
  ['Edit', 'file_path'],
  ['Write', 'file_path'],
  ['Grep', 'path'],
  ['Glob', 'path'],
  ['NotebookEdit', 'notebook_path'],
  ['WebFetch', 'url'],
])

/** The start of each MCP tool name: `mcp__<server>`, `mcp__<server>__<tool>`
 *  and `mcp__<server>__*`. Source: the "MCP" section
 *  (https://code.claude.com/docs/en/permissions#mcp). */
export const MCP_PREFIX = 'mcp__'

/** The separator between the server and the tool in an MCP tool name. */
export const MCP_SEPARATOR = '__'

/** The tools that Claude Code removes from every subagent, even when the
 *  `tools` field lists them. `Agent` at the depth limit and `ExitPlanMode`
 *  outside plan mode are conditional, so they are not here. Source: the first
 *  filter of the "Available tools" section
 *  (https://code.claude.com/docs/en/sub-agents#available-tools), checked on
 *  2026-10-02. */
export const SUBAGENT_REMOVED_TOOLS: readonly string[] = [
  'AskUserQuestion',
  'EndConversation',
  'EnterPlanMode',
  'ScheduleWakeup',
  'WaitForMcpServers',
  'Workflow',
]

/** The tool that a subagent keeps only when its `permissionMode` is `plan`.
 *  Source: the same section. */
export const SUBAGENT_PLAN_MODE_TOOL = 'ExitPlanMode'

/** The built-in tools that a background subagent keeps. Claude Code removes
 *  every other built-in tool from it, whether inherited or listed in `tools`.
 *  `Agent` and `ExitPlanMode` follow the conditions of the first filter
 *  wherever the subagent runs, so the second filter keeps them. Source: the
 *  second filter of the "Available tools" section
 *  (https://code.claude.com/docs/en/sub-agents#available-tools), checked on
 *  2026-10-02. */
export const BACKGROUND_TOOL_NAMES: readonly string[] = [
  'Agent',
  'Artifact',
  'Bash',
  'Edit',
  'EnterWorktree',
  'ExitPlanMode',
  'ExitWorktree',
  'Glob',
  'Grep',
  'LSP',
  'Monitor',
  'NotebookEdit',
  'PowerShell',
  'Read',
  'SendMessage',
  'Skill',
  'SubagentHandback',
  'TaskStop',
  'TodoWrite',
  'ToolSearch',
  'WebFetch',
  'WebSearch',
  'Write',
]

/** The tools whose rule specifier is a command pattern, as `Bash(npm run *)`.
 *  `Monitor` takes the permission rules of Bash, and a `PowerShell` rule has
 *  the same shape as a Bash rule. Source: the "Monitor tool" section
 *  (https://code.claude.com/docs/en/tools-reference#monitor-tool) and the
 *  "PowerShell" section
 *  (https://code.claude.com/docs/en/permissions#powershell), checked on
 *  2026-10-10. */
export const COMMAND_RULE_TOOLS: readonly string[] = ['Bash', 'Monitor', 'PowerShell']

/** The tools that the "Bash" section of the permissions page covers: `Bash`,
 *  and `Monitor`, which uses the same rules. The notes on wrappers and
 *  environment runners are in that section. Source:
 *  https://code.claude.com/docs/en/permissions#bash, checked on 2026-10-10. */
export const BASH_RULE_TOOLS: readonly string[] = ['Bash', 'Monitor']
