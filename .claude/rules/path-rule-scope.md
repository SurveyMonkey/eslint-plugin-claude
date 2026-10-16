---
paths:
  - "src/rules/**"
  - "tests/rules/**"
  - "docs/rules/**"
  - "docs/rules-inventory.md"
---

# Rule scope

Before you add or change a rule, make each check below. The reasons are in
[README Scope](../../README.md#scope) and ADR 001 Decisions 2 and 14.

- The source is a page of the Claude Code docs.
- The rule reports a measurable fault. Style, quality, a model judgment and the convention of one
  organization are not faults.
- The rule reads no file out of the git repository.
- No official CLI tool makes the check. Run `claude plugin validate` on a plugin that holds the
  case. Record the result and the Claude Code version in the inventory row. A session tool, such
  as `/doctor`, does not count. If the tool covers the case in part, the rule reports the rest.
  If the tool starts to make the check of a built rule, set `meta.deprecated` with the tool and
  its version. The next major release removes the rule.
