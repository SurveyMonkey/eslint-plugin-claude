# Commands for the docs watch triage

Each command is for a phase of [SKILL.md](SKILL.md). Run them from the repository root. Outside
a clone, add `--repo SurveyMonkey/eslint-plugin-claude` to each `gh` command. Replace `<n>` with
an issue number. `--limit` is needed: `gh issue list` shows 30 issues by default.

## Phase 1: Gather

```sh
gh issue list --label claude-docs-change --state all --limit 300 --json number,title,state
gh issue view <n> --json body,comments,labels,issueType --jq '.body'
gh issue view <n> --json body --jq '.body' | grep -o '<!-- docs-watch:[^ ]*\( rules=[^ ]*\)\? -->'
gh issue view 10 --json comments --jq '.comments[].body' | grep -o 'docs-watch-tracked:[^ ]*'
```

The third command prints the markers of one issue. The key of a marker is
`<page>#<blockId>:<hash>`. The block id is URI encoded. A removed block has the hash
`gone:<old hash>`. The last command reads the tracked-block comments of one group issue (#9 to
#16 and #50).

## Phase 2: Snapshot check

Replace `<name>` with the page path after `/docs/en/`. Change each `/` to `__`. Replace
`<blockId>` with the block id from the marker.

```sh
python3 -c "import json,sys; print([b for b in json.load(open(sys.argv[1]))['blocks'] if b['id']==sys.argv[2]])" docs/docs-snapshot/<name>.json <blockId>
node scripts/docs-watch.ts check
curl -sL <page>.md
```

The first command prints the stored block. Compare its `hash` with the hash in the marker. The
second command writes no file. It lists the block ids that differ from the snapshot, for each
page. The third command prints the live page.

## Phase 3: Coverage check

```sh
grep -n '<heading words>' docs/rule-sources.json docs/rules-inventory.md
grep -rn '<value or field>' src/data docs/rules
```

## Phase 5: Write back

```sh
gh issue edit <n> --title '<type>(<group>): <subject>' --type Feature --parent <group issue> --remove-label claude-docs-change --body-file <file>
gh issue close <n> --comment '<outcome, and the rule or the row that covers it>'
gh issue close <n> --reason 'not planned' --comment '<reason>'
gh issue edit <n> --add-label duplicate
gh issue comment <group issue> --body '<scope note>'
gh issue create --title '<title>' --type Task --body-file <file>
```

`gh` has no flag for the Priority field. Set it in the web page of the issue, or with the
`gh:issues` skill. To rewrite a body, read it first, change the text, and keep the marker line.
Do not write a body from memory.

## Phase 6: Report

```sh
gh issue list --label claude-docs-change --state open
gh issue view <n> --json title,issueType,labels,state
```
