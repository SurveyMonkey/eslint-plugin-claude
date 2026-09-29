---
paths:
  - "**/docs/adr/**"
---

# Architecture Decision Records (ADRs)

An ADR records one decision, after it is made.

- Name: `docs/adr/NNN-descriptive-slug.md`, a zero-padded sequential number and a slug.
- Frontmatter:

  ```yaml
  ---
  type: ADR
  description: <one line>
  status: stable           # draft | stable | deprecated
  created: YYYY-MM-DD
  owner: <github-handle>
  related_issues: []       # optional
  related_milestones: []   # optional; use it when an ADR tracks more than a few issues
  ---
  ```

  `type`, `description`, `status`, `created` and `owner` are required.
- Sections: Context, Decision, Consequences. Status is in the frontmatter, never in a body
  heading.
- Context states the problem so that more than one answer can satisfy it, before the Decision
  names one.
- A superseded ADR is set to `deprecated` and links its replacement. Never delete it.

Section guidance, declined decisions and the pull request checklist are in the `docs-authoring`
skill (`adr.md`, `quality.md`).
