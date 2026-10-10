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

/** The start of the server name in the tool of a claude.ai connector that Claude Code fetches
 *  itself: `mcp__claude_ai_<server>__<tool>`. Source: the "MCP" section
 *  (https://code.claude.com/docs/en/permissions#mcp). */
export const MCP_CONNECTOR_PREFIX = 'claude_ai_'

/** The start of the server name in the tool of a plugin server:
 *  `mcp__plugin_<plugin>_<server>__<tool>`. Source: "Plugin-provided MCP servers"
 *  (https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers). */
export const MCP_PLUGIN_PREFIX = 'plugin_'

/** The server name of the tools that Cowork provides, such as `mcp__workspace__bash`. Source:
 *  the "MCP" section (https://code.claude.com/docs/en/permissions#mcp). */
export const MCP_COWORK_SERVER = 'workspace'

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
