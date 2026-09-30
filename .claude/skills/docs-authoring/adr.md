# ADRs: the detail

An ADR records **one decision, after it is made**. Work that needs agreement on several decisions
before the team builds starts on an issue, and each decision then gets its own ADR.

## Frontmatter keys

`type`, `description`, `status`, `created`, and `owner` are required. `related_issues` and
`related_milestones` are optional. An ADR is `draft` while the decision is proposed, and `stable`
once it is accepted.

**Issues or milestones:** a couple of direct references is fine as `related_issues`. Once an ADR
tracks more than a few issues, group them under a milestone instead. Reference that milestone in
`related_milestones` (formats in [okf.md](okf.md)). This way the frontmatter does not churn as
issues open and close.

**ADRs add no unique keys.** Supersession is a body link per the status model, so there is no
`superseded_by` key.

**Status is frontmatter, not a `## Status` body heading.** The old template's `Proposed` /
`Accepted` / `Superseded by ADR-NNN` vocabulary collapses into the three-value model per
[okf.md](okf.md).

## Sections

Context / Decision / Consequences. The old template's fourth section, Status, is frontmatter now.

**Context establishes the problem before Decision names a solution.** Write Context so it stands
on its own, without the Decision. State the symptom or the constraint that forces it, with
evidence, in terms that admit more than one answer. A Context that says the chosen option is
missing ("we have no X") restates the Decision as its own absence. Check whether any solution,
other than the one in Decision, could satisfy the Context. If not, rewrite the Context in terms
of the underlying symptom. [quality.md](quality.md) has the full litmus test and the evidence
standards.

## A declined decision is an ADR too

A decision not to do something is still a decision. When the team declines a proposal, or cuts a
part of one in review, record the outcome as a short ADR before you delete the proposal:

- Record what was decided, why, and the constraints at the time (team size, product stage, what
  the project commits to). A future reader needs these to see whether their situation differs.
- Do not move the exploration into the ADR. A parked design, with its cost analysis and detail,
  rests on assumptions that will be false for the next reader. It looks like a head start, and it
  is a trap. The pull request holds the design, so link it.
- Cutting scope in review is the process working, not a loss. Record the cut only if the decision
  is worth a record.

## PR checklist

- **New ADR?** A significant architectural decision (new dependency, data-flow pattern, tooling
  change, performance trade-off) requires one.
- **Current ADRs followed?** Changes comply with in-force ADRs (`status: stable`) or explicitly
  note the deviation.
- **Proposal declined, or a part cut in review?** Record the outcome as an ADR, and delete the
  proposal or the cut part in the same PR.
- **ADR superseded?** Set the old one's `status: deprecated`, and link the replacement from its
  body. Do not delete it.
