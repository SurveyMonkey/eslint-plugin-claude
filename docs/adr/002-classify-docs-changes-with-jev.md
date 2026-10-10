---
type: ADR
description: The docs watch classifies each changed Claude Code docs block with three TypeSafe Jev Noul questions and fixed thresholds, keeps its state in docs/ where only a reviewed pull request changes it, and opens deduplicated GitHub issues, with digest issues for the uncited blocks of each page.
status: stable
created: 2026-09-29
owner: brianespinosa
related_issues: [25, 112, 137, 149, 150, 151, 152]
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

**A block that a planned rule cites is not a new rule.** Five issues were changes to blocks of the
hooks page: four `new-rule` issues (#44, #45, #121, #122) and one `needs-triage` issue (#123).
Rows of the Hooks section of `docs/rules-inventory.md` cite each of these blocks (lines 384 to
437 on 2026-10-10).

**One docs change can touch many blocks of one page.** The `onFailure` field of Claude Code
v2.1.295 changed four blocks of the hooks page and added one. The job opened five issues (#121 to
#125). Each body quotes the `onFailure` text. A person read all five to find one change. No
marker names a rule. Inventory rows cite three of the blocks (#121, #122 and #123).

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
each side adds, and each rule that cites the block. A block that is too large for one request
has a placeholder in place of each full text. The questions are constants. Docs text goes only
into the `state`, as data.

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
| `requirement` | 0.5 | 0.4 | `new-rule` | `needs-triage` | no finding |

Code decides these cases with no model call:

- A removed block and an added block on one page have the same body hash, and a rule or an
  inventory row cites the old block: `moved` (Decision 6). When nothing cites the old block: no
  finding.
- A block that a heading cites is gone, and it is not a move: `rule-removal`.
- A block that no rule cites is gone: no finding.
- A mapped heading appears twice, a mapped heading is on neither the page nor the snapshot, the
  snapshot has no source for a mapped heading, or a page has no snapshot: `needs-triage`.
- A block is too large for one request, and no request with its changed lines can go:
  `needs-triage`. This is the case when the changed lines are too large, the block has one text
  only, or the two texts have no changed line. A block with one text has no earlier or later
  text to compare. Its text is new, or removed, or it has no stored old text.

A block that is too large for one request, and has a diff that fits, gets a model call. The
request has the lines that each side adds and no full text. The Reason of a finding from that
request says that Jev judged the changed lines.

The request pins `jev-1.13.0`, because the thresholds come from that version. A Noul has no
confidence value, so a finding reports `|2p - 1|` as its confidence.

**The inventory is a second source map.** `docs/rules-inventory.md` lists the rule candidates,
built and not built. Each rule row cites footnotes, and each footnote names a page and a
heading. The classifier reads the rule tables of each `###` section of "Rules by group". A
table in a `####` subsection belongs to its `###` section. A footnote finds its block by the
anchor of its link first, because the docs IDs are not always the slug of the heading. When no
block on the page or in the snapshot has that ID, the heading finds the block. The classifier
tracks a changed, added or removed block when an inventory footnote cites it. A heading of
`docs/rule-sources.json` that cites the block stops this. A heading that cites the whole page
does not. The output lists each tracked block in `tracked`, with the rule rows that cite it in
each section. A tracked block gets the same request and the same findings as before. Decision 8
tells what the issue step does with it. The classifier reads only the pages that the map cites.
The job does not watch a page that only the inventory cites.

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

- The lowest `alters` for a `rule-update` case in the spike is 0.51. The `no` value of 0.2 is far
  below it. The two `no-change` cases between 0.2 and 0.5 go to a person.
- The highest `requirement` for a `no-change` block is 0.06, and the lowest for a `new-rule`
  block is 0.73. The band from 0.2 to 0.5 is empty in this spike data.
- Seven live blocks that no rule cites had a `requirement` value from 0.21 to 0.33. They are
  #104, #105, #110, #111, #123, #125 and #133. All seven needed no change. So the
  `requirement` `no` value is 0.4. A skipped block is a missed candidate, not a broken rule.
- The `alters` value stays 0.2. Two live cases fell in its band (#103 at 0.27 and #118 at
  0.24). Neither changed the rule that it cited, and #118 led to a new rule. Two cases are too
  few to move the value.
- The classifier summary lists each block that needs no change. For a block that no rule
  cites, it adds the `requirement` value.
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
the docs, and a person has not checked them yet. The `alters` and `obsolete` values come from the
same 24 cases, and no held-out set exists. The `requirement` `no` value also uses seven live
cases. Record new cases and their results here before you change a threshold.

### 4. The state lives in `docs/`, and only a reviewed pull request changes it

The snapshot stays in `docs/docs-snapshot/` and the map stays in `docs/rule-sources.json`. The
job never writes them and never commits. A person, or a triage pull request, runs
`node scripts/docs-watch.ts update`. Until then, each run sees the same change again. The
dedupe key below stops a second issue for it.

### 5. The dedupe key is a hidden marker with the block hash

Each issue body starts with
`<!-- docs-watch:<kind>:<page>#<blockId>:<hash> rules=<ids> -->`. The hash is the new block
hash. For a removed block, it is `gone:` and the old hash, so a removal never matches an issue
about the new text of the block. For a moved block, the block ID is the old one. The hash is
that of the new block. The block ID comes from the docs, so the marker holds it URI encoded.
` rules=<ids>` lists the rules of the issue, and is not there when the issue names no rule.

All findings for one page, block and hash in one run give one issue, with all their rules and
reasons. That issue can be one section of a digest issue (Decision 8). The first kind in this
list names the issue: `moved`, `rule-removal`, `rule-update`, `needs-triage`, `new-rule`.
`moved` is first, because the issue keeps the fields of the first kind only. Only a `moved`
finding has the new heading. Before it opens an issue, `scripts/docs-issues.ts` reads the bodies
of all open issues. An open issue for the same page, block and hash stops a new issue when the
open issues name all its rules. The kind does not count. A Jev answer near a threshold can
change the kind from one run to the next. A rule that the open issues do not name gives a new
issue. A block that changes again has a new hash, so it gets a new issue.

A digest issue has the marker of each of its blocks, so this check works for each block. An open
digest stops a new issue for each block that it names. A later run that finds new blocks of the
same page opens issues for the new blocks only: an issue of its own for one block, or a new
digest for two or more.

Only open issues count. Close an issue in the pull request that refreshes the snapshot. If a
person closes it first, the next run opens it again.

### 6. A moved section on one page gives one `moved` issue

This decision reverses Ruling 8 on #25, which left moved sections to the triage session. A
renamed heading gave two issues. One was a `rule-removal` issue for the old heading, and one was
a `new-rule` issue for the new heading. A person matched them by their texts. The block texts
of #117 and #129 differ only in the heading line.

**The body hash.** Each block in the snapshot can have a `bodyHash`: the SHA-256 of the block
text after its heading. The heading of a Markdown block is its first line. The heading of an
HTML block is all its lines, from the opening tag to the closing tag. Blank lines at the start
of the body and white space at its end do not count. A block with no body has no body hash.
`update` writes it. A snapshot file without it stays valid, and the docs watch check does not
read it.

**The move.** A run can find a removed block and an added block on one page with the same body
hash. The body hash of the old block comes from the snapshot. The classifier then gives one
`moved` finding, with no Jev call. The finding names the old heading and block, and the new
heading and block key. It also names the rules and the inventory rows that cite the old block.
Neither block gets another finding, a Jev call or a tracked entry.
A move of a block that no rule and no inventory row cites gives no finding.

These give no move, and each block keeps the findings of a removed or an added block:

- two removed blocks, or two added blocks, with one body hash, because the code does not guess
  the pair
- a removed block with no stored body hash, until `update` refreshes the snapshot of its page
- a block with no body
- the page title, old or new
- a move from one page to another page.

**The cross-reference line.** A removed heading and an added heading on one page can share three
or more words. When neither block is part of a move, each finding of the two blocks names the
other block. A word is a run of letters and digits, in lowercase. Each word counts once. A word
of one or two characters does not count. The old heading is the mapped heading, else the title
in the stored page text. Without these, it is the inventory heading, else the block key.

**The issue.** A `moved` issue is a Task titled
`docs(<rules>): move the footnote of <rules> to the renamed heading`. With no rule, the title is
`docs: move the footnote of the inventory to the renamed heading`. The title length rule of
every issue applies. The body names the old and new headings and the new anchor. It names each
footnote to change in `docs/rules/<rule>.md` and `docs/rules-inventory.md`. Its Scope is the
steps of "A moved section" in `docs/runbooks/docs-watch-triage.md`. The issue step refuses a
`moved` finding that does not fit its kind (Decision 7). The finding must have both hashes, the
new text, and the new heading and block. The old text can be absent, because the snapshot
stores the text of a mapped block only.

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
  stops the issue step with exit 1. A digest issue counts as one issue. A dry run has no limit.
- A check report that the workflow cannot read fails the job.

### 8. Issues open with the App token, as a Task, with the `claude-docs-change` label

The workflow gets a token from `actions/create-github-app-token` with only
`permission-issues: write`. The job keeps `contents: read`. Each issue has the type `Task` and
the `claude-docs-change` label. The type tells the kind of work. The label tells the source, so
a person can find the docs watch issues. Issue types are set for the organization, so a type is
not the source (#112). Its body follows the Why, Scope, Acceptance and References format. For a changed block
with old and new text, the body shows a diff, then the full old section and the full new section
in two collapsed parts. Docs text goes in a fence that is longer than any fence in the text. Each `@` and each `<!--` in docs text gets a
word joiner, so the text makes no mention and no marker.

**A tracked block gives a comment on its group issue.** `GROUP_ISSUES` in
`scripts/docs-issues.ts` gives the group issue of each section of "Rules by group". A tracked
block in a section with no group issue stops the step before it writes. While a group issue is
open, a run posts at most one comment on it. The comment names each new tracked block and the
rows of that section that cite it. It quotes the block text as an issue body does, but with no
Before and After parts. It shows a diff, or the old and new texts when one has more than 1,000
lines. Or it shows the new text only, or the old text of a removed block. When no text is
available, a note says so. Each block has the hidden marker
`<!-- docs-watch-tracked:<page>#<blockId>:<hash> -->`, with the key of Decision 5. The prefix is
not `docs-watch:`, so the issue dedupe does not read it. The step reads the comments of each open
group issue. It does not post a block again while its marker is in a comment.

A tracked block opens no issue for a finding with no rule while one of its group issues is open.
The comment takes its place. When all its group issues are closed, the finding opens its
issue, with a line that names the inventory rows. A finding that names a rule opens its issue as
before. Docs text in a comment gets the same fence and word joiners as an issue body. The markers
come first. The step cuts the text after them so that the markers and the text take at most
60,000 characters. A note of the cut follows, so the comment stays under the GitHub limit of
65,536. A cut never removes a marker. Comments do not count toward the limit of 20 issues. A dry
run prints each comment and posts none. The step also stops before it writes for four causes.
The findings file has no `tracked` list. A tracked block is not valid. A tracked block is in the
list twice. A group issue has a state that is not `open` or `closed`.

**The uncited blocks of a page share a digest issue.** After the dedupe and the group comment
path, the step takes each `new-rule` and `needs-triage` finding that names no rule. A finding
of a tracked block whose group issues are all closed is one of them. When a page has two or
more of them, they give a digest issue, titled `docs(<page>): triage <n> changed blocks`.
`<page>` is the page path after `/docs/en/`. The title has no scope when the page has no
`/docs/en/`, when the path after it is empty, or when the title is longer than 69 characters.
The body starts with the marker of each block, one on each line. Then it has a section for each
block, with its metadata and its diff or its quoted text. The section of a tracked block also
has the line of its inventory rows. A section has no Before and After parts. A page with one
such finding gets the issue of that block, as before.

Each of these keeps an issue of its own, because it needs its own decision:

- a `moved` finding
- a `rule-update` or `rule-removal` finding
- a finding that names a rule, a whole-page rule included

**The size of a digest.** A digest holds at most 20 blocks (`MAX_DIGEST_BLOCKS`). Its whole body
takes at most 60,000 characters, so it stays under the GitHub limit of 65,536. The step cuts no
section. It puts the blocks of a page in groups, in order. When the next block would pass 20
blocks or 60,000 characters, that block starts a new group. A block whose digest alone passes
60,000 characters gets the issue of that block. A group of one block also gets the issue of that
block. Each fence in a section holds at most 280 characters of its text
(`MAX_DIGEST_QUOTE`). A fence of a text of backticks takes three times its text, and a section
can have two fences. The worst body in the tests, 20 such sections with a line of inventory rows
each, takes 57,826 characters.

The limit of 20 new issues counts issues, not blocks, so a digest counts as one.

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
- `GROUP_ISSUES` must change when a section of "Rules by group" is added or renamed.
- When all group issues of a tracked block are closed, each finding of the block opens its issue.
  That issue can be one section of a digest. A tracked block with no finding gets nothing: a
  removed block that no whole-page rule cites, or a block with a low Jev answer.
- While a group issue is open, a finding of a tracked block that names no rule opens no issue.
  The finding stays in the classifier output. A person reads the comment when they build the row.
  A finding that names a whole-page rule still opens its issue.
- A page whose snapshot has no body hash gets no move until `update` refreshes it. An `update`
  with an older copy of `scripts/docs-watch.ts` writes a page with no body hash.
- A move to another page, or a move that also changes the body, still gives two issues. The
  cross-reference line helps a person match them on one page only.
- A digest issue can need a decision for each block. It closes in the pull request that makes
  all of them. A digest quotes at most 280 characters of each text, so a person reads the page
  for the rest.
- A page with large blocks gives more issues, because the split depends on the size of each
  block.
- An open digest stops an issue for each block that it names. A new block of the page in a
  later run gets an issue of its own, or a new digest with the other new blocks.
- A new Jev version needs a new run of the spike before the pin moves.
