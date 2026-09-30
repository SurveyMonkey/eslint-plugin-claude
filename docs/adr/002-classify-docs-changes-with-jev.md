---
type: ADR
description: The docs watch classifies each changed Claude Code docs block with three TypeSafe Jev Noul questions and fixed thresholds, keeps its state in docs/ where only a reviewed pull request changes it, and opens one deduplicated GitHub issue for each changed block.
status: stable
created: 2026-09-29
owner: brianespinosa
related_issues: [25]
---

# ADR 002: Classify docs changes with Jev and open issues

## Context

**A docs change can make a rule wrong, and nobody sees it.** The rules in `src/rules/` come
from the Claude Code docs. `docs/rule-sources.json` maps each rule to its docs blocks. The docs
watch (`scripts/docs-watch.ts`) finds the blocks that changed since the snapshot in
`docs/docs-snapshot/`. It does not say what a change means for a rule.

**Most changes do not affect a rule, and some do.** The Claude Code changelog on 2026-09-29
lists 407 releases. Among them:

- A limit changed: the skill listing cap went from 250 to 1,536 characters (2.1.105).
  `claude/skill-description-max-length` checks that value.
- A name was added: the `StopFailure` hook event (2.1.78). `claude/hooks-event-name-known`
  checks the list of event names.
- Many changes are to words only, examples, bug fixes, CLI commands or environment variables. No lint
  rule reads them.

**The constraints are these:**

- The job runs each day with no person present.
- A wrong "no change" hides a rule defect until a person reads the docs again. A wrong
  "change" costs a person a few minutes to close an issue.
- Docs text is not trusted input. It goes into a model request and into an issue body.
- Rulings 2 and 9 on #25: the state changes only in a reviewed pull request, and the job opens
  issues with the GitHub App token pattern of `release.yml`.
- The result must be repeatable, and each run must cost little.

The options were a person who reads each report, a keyword rule in code, a general language
model, and TypeSafe Jev.

## Decision

### 1. The classifier is Jev, with three Noul questions and fixed thresholds

`scripts/docs-classify.ts` sends one request for each changed, added or removed block. All
questions share one `state`: the page, the heading, the old text, the new text, the lines that
each side adds, and each rule that cites the block. The questions are constants. Docs text goes
only into the `state`, as data.

| Question | Asked for | Yes means |
| - | - | - |
| `alters_<i>` | each rule that cites the block | The change alters a value, limit, name, default, file location or severity that the rule uses. |
| `obsolete_<i>` | each rule that cites the block | The rule has no purpose left: the docs now allow, support or remove the whole practice. |
| `requirement` | every block, used when no heading cites it | The block states a requirement on a configuration file that a lint check can measure. |

The code turns each answer into a finding. A value at or above `yes` is a yes. A value at or
below `no` is a no. A value between them goes to a person.

| Answer | `yes` | `no` | Yes gives | Between gives | No gives |
| - | - | - | - | - | - |
| `obsolete_<i>` | 0.5 | 0.35 | `rule-removal` | `needs-triage` | the next row |
| `alters_<i>` | 0.5 | 0.2 | `rule-update` | `needs-triage` | no finding |
| `requirement` | 0.5 | 0.2 | `new-rule` | `needs-triage` | no finding |

Code decides these cases with no model call:

- A block that a heading cites is gone: `rule-removal`.
- A block that no rule cites is gone: no finding.
- A mapped heading appears twice, a mapped heading is on neither the page nor the snapshot, the
  snapshot has no source for a mapped heading, or a page has no snapshot: `needs-triage`.
- A block is too large for one request: `needs-triage`.

The request pins `jev-1.13.0`, because the thresholds come from that version. A Noul has no
confidence value, so a finding reports `|2p - 1|` as its confidence.

### 2. The spike data

Each case in `tests/fixtures/docs-classify/cases.json` rebuilds the shape of a real docs change,
trimmed to a few lines. The source of most cases is a changelog entry. The hard cases include a
change to words only, a moved section, a default change on another key, and four deprecation shapes. There
are 24 cases: 7 `rule-update`, 3 `rule-removal`, 4 `new-rule` and 10 `no-change`. One removal
case is a removed block, which needs no model call.

The final questions ran four times on the 23 other cases. The table gives the range of each
Noul over the four runs. `tests/fixtures/docs-classify/jev-responses.json` holds the fourth run.

| Case | Label | `alters` | `obsolete` | `requirement` | Result |
| - | - | - | - | - | - |
| listing-cap-raised | rule-update | 0.59 to 0.69 | 0.03 to 0.04 | | rule-update |
| when-to-use-leaves-cap | rule-update | 0.92 | 0.23 to 0.28 | | rule-update |
| listing-cap-configurable | rule-update | 0.54 to 0.58 | 0.06 to 0.07 | | rule-update |
| hook-event-added | rule-update | 0.78 to 0.84 | 0.03 | | rule-update |
| hook-event-deprecated | rule-update | 0.51 to 0.56 | 0.06 to 0.07 | | rule-update |
| hook-event-renamed | rule-update | 0.81 to 0.86 | 0.04 | | rule-update |
| commands-stop-loading | rule-update | 0.55 to 0.62 | 0.08 to 0.11 | | rule-update |
| listing-cap-removed | rule-removal | 0.77 to 0.82 | 0.79 to 0.81 | | rule-removal |
| commands-not-legacy | rule-removal | 0.27 to 0.29 | 0.70 to 0.74 | | rule-removal |
| cut-short-wording | no-change | 0.05 to 0.06 | 0.02 | | no finding |
| frontmatter-new-field | no-change | 0.08 to 0.09 | 0.02 to 0.03 | | no finding |
| hook-event-description | no-change | 0.14 to 0.16 | 0.03 | | no finding |
| never-fires-wording | no-change | 0.07 to 0.08 | 0.03 | | no finding |
| manifest-hooks-array | no-change | 0.31 to 0.34 | 0.02 to 0.03 | | needs-triage |
| skills-key-default | no-change | 0.40 to 0.46 | 0.11 to 0.14 | | needs-triage |
| plugin-agent-fields | new-rule | | | 0.84 to 0.85 | new-rule |
| default-enabled | new-rule | | | 0.90 to 0.91 | new-rule |
| compatibility-limit | new-rule | | | 0.74 to 0.76 | new-rule |
| hooks-section-moved | new-rule | | | 0.73 to 0.76 | new-rule |
| hook-output-to-disk | no-change | | | 0.02 | no finding |
| web-fetch-env | no-change | | | 0.03 | no finding |
| output-style-command | no-change | | | 0.04 | no finding |
| bom-loads | no-change | | | 0.05 to 0.06 | no finding |

Accuracy by label, on each of the four runs:

| Label | Cases | Correct | To a person | Wrong |
| - | - | - | - | - |
| `rule-update` | 7 | 7 | 0 | 0 |
| `rule-removal` | 3 | 3 | 0 | 0 |
| `new-rule` | 4 | 4 | 0 | 0 |
| `no-change` | 10 | 8 | 2 | 0 |

**Why these thresholds.** The `no` values matter most, because a no opens no issue.

- The lowest `alters` for a `rule-update` case is 0.51. The `no` value of 0.2 is far below it.
  The two `no-change` cases between 0.2 and 0.5 go to a person.
- The highest `requirement` for a `no-change` block is 0.06, and the lowest for a `new-rule`
  block is 0.73. The band from 0.2 to 0.5 is empty in this data.
- `obsolete` is 0.70 or more for a removal, and 0.28 or less for the other cases.
- The `yes` value of `alters` has a small margin: `hook-event-deprecated` is 0.51 to 0.56. A
  value below 0.5 gives `needs-triage`, not a silent miss. Both results open an issue.

**Why not a Choice.** The spike also asked a Choice among the four labels, over three runs. It
was correct 43 times in 69: `no-change` 30 of 30, `rule-removal` 6 of 6, `rule-update` 7 of 21,
and `new-rule` 0 of 12. It chose `no-change` for most changes. The production request does not
ask it.

**How the questions changed.** The first run of the `alters` criteria missed two
`rule-update` cases (0.21 and 0.27). The `true` criterion then got the words "renamed" and
"deprecated", and two sentences about lists of names and about text that counts toward a limit.
One case was also rebuilt, because its old text did not agree with the current rule.

### 3. The comparison with a Claude model uses reference labels only

No Anthropic API key exists in this environment, so no Claude model classified the cases. The
labels are the reference. The Claude Code session that wrote this change set them by hand from
the docs, and a person has not checked them yet. The thresholds come from the same 24 cases, and
no held-out set exists. Record new cases and their results here before you change a threshold.

### 4. The state lives in `docs/`, and only a reviewed pull request changes it

The snapshot stays in `docs/docs-snapshot/` and the map stays in `docs/rule-sources.json`. The
job never writes them and never commits. A person, or a triage pull request, runs
`node scripts/docs-watch.ts update`. Until then, each run sees the same change again. The
dedupe key below stops a second issue for it.

### 5. The dedupe key is a hidden marker with the block hash

Each issue body starts with
`<!-- docs-watch:<kind>:<page>#<blockId>:<hash> rules=<ids> -->`. The hash is the new block
hash. For a removed block, it is `gone:` and the old hash, so a removal never matches an issue
about the new text of the block. The block ID comes from the docs, so the marker holds it URI
encoded. ` rules=<ids>` lists the rules of the issue, and is not there when the issue names no
rule.

All findings for one page, block and hash in one run give one issue, with all their rules and
reasons. The first kind in this list names the issue: `rule-removal`, `rule-update`,
`needs-triage`, `new-rule`. Before it opens an issue, `scripts/docs-issues.ts` reads the
bodies of all open issues. An open issue for the same page, block and hash stops a new issue
when the open issues name all its rules. The kind does not count. A Jev answer near a threshold
can change the kind from one run to the next. A rule that the open issues do not name gives a
new issue. A block that changes again has a new hash, so it gets a new issue.

Only open issues count. Close an issue in the pull request that refreshes the snapshot. If a
person closes it first, the next run opens it again.

### 6. A moved section gives two issues, and a person matches them

Ruling 8 on #25 leaves moved sections to the triage session. When a cited section moves to a new
heading, the old block is gone and the new block has no rule. The job opens a `rule-removal`
issue for the old heading. It opens a `new-rule` issue for the new heading when the
`requirement` answer is a yes. The runbook `docs/runbooks/docs-watch-triage.md` tells a person
how to match the two issues and keep the rule.

### 7. The job fails closed

- A failed Jev call, a timeout after 30 seconds, an answer that is not a valid Noul, or an
  answer between two thresholds gives a `needs-triage` finding.
- These stop the classifier with exit 1:
  - a map that cites no page, or a failed docs fetch
  - a page that the block split cannot read, or a page with no title heading
  - no `TYPESAFE_API_KEY` when a block needs a call.

  The block split cannot read a code fence that is not closed. It also cannot read a line that
  looks like an HTML heading in a form that it does not know.
- A finding that is not valid, a failed `gh` call, or more than 20 new issues in one live run
  stops the issue step with exit 1. A dry run has no limit.
- A check report that the workflow cannot read fails the job.

### 8. Issues open with the App token, as a Task, with no label

The workflow gets a token from `actions/create-github-app-token` with only
`permission-issues: write`. The job keeps `contents: read`. Each issue has the type `Task` and
no label. Its body follows the Why, Scope, Acceptance and References format. Docs text goes in a
fence that is longer than any fence in the text. Each `@` and each `<!--` in docs text gets a
word joiner, so the text makes no mention and no marker.

## Consequences

- Each block costs one request of about 1,400 input tokens. At the price on 2026-09-29
  ($0.042 for each million tokens), a run with ten changed blocks costs much less than one cent.
- The person must add the `TYPESAFE_API_KEY` secret, and confirm that the release App can write
  issues and set the issue type. The App token path and the schedule have not run on GitHub.
- The spike has 24 cases from one author. The author rebuilt some shapes from a similar change,
  for example the removal of the description cap. The result can differ on real changes.
- A new requirement inside a block that a heading cites gives no `new-rule` issue. The rule
  question for that block is the only signal.
- The snapshot has only the hash of an uncited block. A change to the words only of such a block
  can give a `new-rule` issue, because the question sees the new text only.
- A page with no snapshot gives one `needs-triage` issue, not one issue for each block.
- A new Jev version needs a new run of the spike before the pin moves.
