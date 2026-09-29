---
paths:
  - "**/docs/adr/**"
---

# Architecture Decision Records (ADRs)

An ADR records **one decision, after it is made**. Shared frontmatter is in `path-docs.md`. This
rule adds only what is specific to ADRs.

## Naming

`docs/adr/NNN-descriptive-slug.md`: a zero-padded sequential number and a slug.

## Frontmatter

```yaml
---
type: ADR
description: <one line>
status: stable           # draft | stable | deprecated
created: YYYY-MM-DD
owner: <github-handle>
related_issues: []       # optional
related_milestones: []   # optional
---
```

`type`, `description`, `status`, `created` and `owner` are required. An ADR is `draft` while
the decision is proposed, and `stable` when the team accepts it. Supersession is a body link, so
there is no `superseded_by` key.

## Sections

Context, Decision, Consequences.

**Context states the problem before Decision names a solution.** Write Context so that it is
complete without the Decision. State the symptom or the constraint, with evidence, in terms that
permit more than one answer. A Context that says "we have no X" only restates the Decision.
Check that a solution other than the Decision could satisfy the Context. If none can, write the
Context again in terms of the symptom.

## Pull request checklist

- **New ADR?** A significant decision needs one: a new dependency, a data-flow pattern, a tooling
  change, a performance trade-off.
- **Current ADRs followed?** A change complies with each `stable` ADR, or states the deviation.
- **ADR superseded?** Set the old one to `deprecated` and link the replacement from its body. Do
  not delete it.
