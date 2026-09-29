# Quality: problem statements and evidence

Read this before you write the Context of an ADR, the Why of an issue, the reasons for a rule in
`docs/rules-inventory.md`, or the motivation in a pull request description.

## Problem statements

A problem statement describes a symptom or a harm, with evidence. That is something that a user
or a maintainer experienced, or a concrete risk of it that you can argue. The absence of a tool or
a capability is not a problem statement. "We have no X" is the proposal, stated again as its own
absence. It makes the proposal the only possible answer.

**Litmus test.** Ask which solutions, other than the proposal, could satisfy the statement. If the
answer is none, it is a gap statement. Write it again in terms of the symptom, and let the
Decision (or the proposal) argue for the answer.

**The same test applies during review.** If a reviewer removes a motivation and the proposal stays
the same, the doc justifies a solution that was chosen first. Open the question again. Do not put
a new motivation in its place.

## Evidence

- **Verified current state.** Cite files, line numbers and the behavior that you saw. Put a date
  on a fact that can drift, such as a version or a count.
- **Audit table.** When a change affects one member of a family (one rule group, one config, one
  workflow), show the full family, so that no sibling is missed.
- **Numbers, not adjectives.** Write "39 rules in 5 groups", not "many rules". If you do not have
  the numbers, say so, and say how to get them.
