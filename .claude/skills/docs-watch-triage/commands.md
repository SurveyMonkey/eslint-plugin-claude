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
`<blockId>` with the block id from the marker. The command decodes the block id.

```sh
python3 -c "import json,sys,urllib.parse; print([b for b in json.load(open(sys.argv[1]))['blocks'] if b['id']==urllib.parse.unquote(sys.argv[2])])" docs/docs-snapshot/<name>.json <blockId>
node scripts/docs-watch.ts check
curl -sL <page>.md
```

The first command prints the stored block. Compare its `hash` with the hash in the marker. The
second command writes no file in the repository. It lists the block ids that differ from the
snapshot, for each page. A page that lost a cited heading is in `errors` only. The third command
prints the live page.

## Phase 3: Coverage check

```sh
grep -n '<heading words>' docs/rule-sources.json docs/rules-inventory.md
grep -rn '<value or field>' src/data docs/rules
```

## Phase 5: Write back

```sh
gh issue edit <n> --title '<type>(<group>): <subject>' --type <Bug|Feature|Task> --remove-label claude-docs-change --body-file <file>
gh issue edit <n> --parent <group issue>
gh issue close <n> --comment '<outcome, and the rule or the row that covers it>'
gh issue close <n> --reason 'not planned' --comment '<reason>'
gh issue edit <n> --add-label duplicate
gh issue comment <group issue> --body '<scope note>'
gh issue create --title '<title>' --type Task --body-file <file>
```

The second command is for a new rule candidate only. `gh` has no flag for the Priority field.
Set it in the web page of the issue, or with the `gh:issues` skill. To rewrite a body, read it
first, change the text, and keep the marker line. Do not write a body from memory.

## Phase 6: Report

```sh
gh issue list --label claude-docs-change --state open
gh issue view <n> --json title,issueType,labels,state,parent,milestone
```

`gh issue view` has no field for Priority. Read it on the web page of the issue.

## Phase 7: Refresh

Replace `<root>` with the repository root. Replace `<wt>` with
`<root>/.claude/worktrees/docs-watch-refresh`. Replace `<file>` with a file that holds the pull
request body, with its `Closes #<n>` lines. These commands do not need the repository root as
the working directory.

```sh
gh pr list --head docs-watch-refresh --state open --json number,url,autoMergeRequest
git -C <root> fetch origin main
git -C <root> worktree add <wt> -b docs-watch-refresh origin/main
pnpm --dir <wt> install --frozen-lockfile
pnpm --dir <wt> docs:seed
node <wt>/scripts/docs-watch.ts update <wt>
git -C <wt> add docs/rule-sources.json docs/docs-snapshot
git -C <wt> add docs/rules docs/rules-inventory.md
git -C <wt> commit -m 'docs(docs-watch): refresh the docs snapshot'
pnpm --dir <wt> exec vitest run tests/settings-env.test.ts tests/rules/settings-key-scope.test.ts
git -C <wt> push -u origin docs-watch-refresh
gh pr create --base main --head docs-watch-refresh --title 'docs(docs-watch): refresh the docs snapshot' --body-file <file>
gh pr merge <n> --auto --squash
gh pr checks <n> --watch
```

The first command prints `[]` when no refresh is open. If the `vitest` command fails, do not
push and open no pull request. Run the two commands of the last block, then stop. See step 5 of
Phase 7 in SKILL.md. `gh pr create` opens a pull request that is ready unless you give
`--draft`. Do not give it. The commit runs the pre-commit hook.

For one loop after a `docs-snapshot` failure: the listed run must start after `gh workflow run`.
If its `createdAt` is older, list again. If the run opens no issue for a block that the log
names, open one by hand with `gh issue create`. Start its body with the marker line from the
log, and leave it open.

```sh
gh workflow run docs-watch.yml --ref main
gh run list --workflow docs-watch.yml --event workflow_dispatch --branch main --limit 1 --json databaseId,status,createdAt
gh run watch <run id> --exit-status
node <wt>/scripts/docs-watch.ts update <wt>
git -C <wt> add docs/rule-sources.json docs/docs-snapshot
git -C <wt> add docs/rules docs/rules-inventory.md
git -C <wt> commit -m 'docs(docs-watch): refresh the docs snapshot again'
git -C <wt> push
gh pr edit <n> --body-file <file>
```

Remove the worktree after the push, or after a failed `vitest` command:

```sh
git -C <root> worktree remove <wt>
git -C <root> branch -D docs-watch-refresh
```
