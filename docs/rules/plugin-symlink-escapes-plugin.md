---
type: Reference
description: The ESLint rule claude/plugin-symlink-escapes-plugin, which reports a symbolic link under a plugin whose target is out of the plugin and inside its marketplace, because only a marketplace install copies that target.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-symlink-escapes-plugin`

Keep the target of a link under a plugin inside the plugin.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `warn` | portability | `**/.claude-plugin/plugin.json` |

## Rule details

A plugin in a marketplace can hold a link to a file of another plugin of the same marketplace.
When a marketplace install copies the plugin, it copies that target in place of the link. A plugin
installed from a local path skips the link. A plugin from a `command` source in the default copy
mode skips it too. Both keep only the links that resolve inside the plugin.[^symlinks] So the
plugin works after one install and breaks after another.

The rule walks the plugin on disk and reports each link whose real target is out of the plugin and
inside the marketplace root. The report is on the manifest. The message names the link from the
plugin root, and the target from the repository root. A chain of links gets one report for each
link that leaves. The walk goes depth first, with the names of each folder in alphabetical order.

The marketplace root is the folder that holds the nearest `.claude-plugin/marketplace.json`. The
search starts at the plugin root and goes up to the top of the repository. The catalog need not
list the plugin. The rule reads the file only to find its folder. When no folder holds a catalog, the plugin root is
the marketplace root. Then no link can leave the plugin and stay in the marketplace, so the rule
makes no report.

The rule cannot know how a user installs the plugin, so it is a warning. The pages also differ
for a plugin that loads in place. The loading page says that a relative-path plugin of a
marketplace that a user added from a local path loads in place and is never copied.[^loading] The
marketplace page says that a local-path install skips these links.[^symlinks] The docs do not say
if an in-place load follows a link that leaves the plugin. The rule does not decide this.

The rule reads the files on disk, not the files that Git tracks. A link that Git ignores can cause
a report. The walk does not enter a link to a folder, because the link is the item that the
install handles. It skips `.git` and `node_modules` folders.

A link whose target is out of the marketplace is for
[`plugin-symlink-escapes-marketplace`](plugin-symlink-escapes-marketplace.md). So one link gets
one report at most.

The rule makes no report in these cases:

- The target is in the plugin, or out of the marketplace.
- The link has no target, or the link is a loop.
- The target is out of the repository. The rule reads no file out of the repository.
- A folder of the plugin cannot be listed. The rule skips that folder and still reads the others.
- A `marketplace.json` above the plugin cannot be read. It can be a link with no target, or a
  link out of the repository.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

Fail: a plugin in `site/plugins/p/` with a link `skills/s` to `../../q/skills/s`, a skill of the
plugin `q` in the same marketplace.

Pass: the same skill copied into the plugin `p`, or a link to a file inside `p`.

## Options

None.

## Sources

[^symlinks]: [Host and maintain a marketplace: Share files within a marketplace with symlinks](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks)
[^loading]: [Plugin loading reference: In-place and copied plugins](https://code.claude.com/docs/en/plugins/loading#in-place-and-copied-plugins)
