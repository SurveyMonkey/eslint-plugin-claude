---
paths:
  - "**/docs/**"
---

# Documentation frontmatter (OKF profile)

Every non-reserved `.md` file under `docs/` carries YAML frontmatter in this profile of the
[Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).
`index.md` and `log.md` are reserved and exempt. Agent-context files such as `CLAUDE.md` carry no
OKF frontmatter.

```yaml
---
type: <ADR | Reference | Runbook>   # required
description: <one line>             # required: the doc's subject, readable standalone
---
```

- The type vocabulary is closed. A doc that fits none is usually a `Reference`.
- ADRs carry `status`: `draft`, `stable` or `deprecated`, and nothing else. `Reference` and
  `Runbook` docs carry no `status`. They carry `stale_after: YYYY-MM-DD`, about six months out.
  Advance it only after you verify the content again.
- Never delete a doc that was in force: set `deprecated` and link its replacement from the body.
  Delete a declined proposal only after you record its outcome.
- Never write a `verified` entry when you write the doc, and never for a comment alone. A change
  to metadata only does not advance `generated.at`.
- A new doc adds its row to the `index.md` of its bundle in the same pull request.

Before you create, amend, supersede or decline a doc, or add trust or staleness metadata, invoke
the `docs-authoring` skill.
