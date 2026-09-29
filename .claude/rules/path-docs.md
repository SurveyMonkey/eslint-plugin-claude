---
paths:
  - "**/docs/**"
---

# Documentation frontmatter (OKF profile)

Every non-reserved `.md` file under `docs/` carries YAML frontmatter. The frontmatter conforms
to this profile of the
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
OKF reserves `index.md` and `log.md`, so they are exempt. Agent-context files such as
`CLAUDE.md` are not knowledge docs and carry no OKF frontmatter. This rule holds what all doc
types share. `path-docs-adr.md` adds only the ADR deltas.

## Required on every doc

```yaml
---
type: <one of the vocabulary below>   # required
description: <one line>               # required: what this doc is, readable standalone
---
```

`index.md` shows `description`, so a reader can decide whether to open the file. Write it as a
statement of the doc's subject, not a copy of its title.

## Type vocabulary

`ADR`, `Reference`, `Runbook`.

A doc that fits none of these is usually a `Reference`. A new type is a change to this profile,
not a local decision.

## Status model

ADRs carry `status`, with OKF's three values only:

| Value | Meaning |
|-------|---------|
| `draft` | In progress or in review. |
| `stable` | Agreed and in force. |
| `deprecated` | Superseded, withdrawn, or no longer in force. |

- **Supersession** is a link in the body, from the deprecated doc to its replacement. Do not
  delete a doc that was in force. Old links must still resolve.
- **Decline.** A proposal that the team does not adopt is deleted, not marked `deprecated`.
  `deprecated` means that a doc was in force once. Record the outcome and its constraints on the
  issue first, and link the pull request that held the proposal.

`Reference` and `Runbook` docs carry no `status`. `stale_after` tracks them.

## Shared keys

| Key | Value |
|-----|-------|
| `owner` | GitHub handle accountable for the doc. |
| `created` | `YYYY-MM-DD`. |
| `related_issues` | Issue numbers that this doc tracks. |
| `related_milestones` | Milestones that group the work that this doc tracks. |

Use `related_milestones` when a doc tracks more than a few issues, so the frontmatter does not
change each time an issue opens or closes. Same-repo references are bare numbers:
`related_issues: [5]`. Cross-repo issues use `owner/repo#24`.

## Trust

```yaml
generated:
  by: <agent-id>
  at: <timestamp>
verified:
  - by: human:<github-handle>
    at: <timestamp>
```

- Do not write a `verified` entry when you write the doc. Add it after a reviewer approves the
  pull request, with `at:` set to the approval date.
- A comment is not verification. You can record it in `sources`, but never in `verified`.
- A change to the body advances `generated.at`. `verified` entries older than it are stale.
- A change to metadata only (`status`, `stale_after`, `description`, `owner`, trust entries)
  does not advance `generated.at`.

## Staleness

Put `stale_after: YYYY-MM-DD` on docs that describe the current state: `Reference` and
`Runbook`. Set it about six months out. ADRs are records of a decision at one time, so they
carry no `stale_after`. When the date passes, check the content against the code first, then
advance the date.

## Navigation

`docs/` and `docs/adr/` are bundle roots. The `index.md` of each declares `okf_version: "0.2"`
and lists its docs by `description`. When you add a doc, add its row to the index in the same
pull request.
