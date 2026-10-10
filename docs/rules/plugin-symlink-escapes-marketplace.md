---
type: Reference
description: The ESLint rule claude/plugin-symlink-escapes-marketplace, which reports a symbolic link under a plugin whose target is out of the marketplace, because Claude Code skips such a link when it copies the plugin.
owner: brianespinosa
created: 2026-10-10
related_issues: [11]
stale_after: 2027-04-10
generated:
  by: claude-code
  at: 2026-10-10T00:00:00Z
---

# `plugin-symlink-escapes-marketplace`

Keep the target of a link under a plugin inside the marketplace.

| Config | Severity | Category | Files |
|--------|----------|----------|-------|
| `recommended`, `strict` | `error` | load | `**/.claude-plugin/plugin.json` |

## Rule details

A plugin can hold symbolic links to share files with other parts of its marketplace. When Claude
Code copies the plugin into its cache, it handles each link by where the target resolves. A target
in the plugin stays a relative link. A target elsewhere in the marketplace is copied in place of
the link. A target out of the marketplace is skipped for security.[^symlinks] The installed plugin
then lacks the file, and a skill or a script that needs it fails.

The rule walks the plugin on disk and reports each link whose real target is out of the
marketplace root. The report is on the manifest. The message names the link from the plugin root,
and the target from the repository root. A chain of links gets one report for each link that leads
out. The walk goes depth first, with the names of each folder in alphabetical order.

The marketplace root is the folder that holds the nearest `.claude-plugin/marketplace.json`. The
search starts at the plugin root and goes up to the top of the repository. The catalog need not
list the plugin. The rule reads the file only to find its folder. A catalog that does not parse
still marks its folder. When no folder holds a catalog, the plugin root is the marketplace root. Then each link
that leaves the plugin gets this report.

The rule reads the files on disk, not the files that Git tracks. A link that Git ignores can cause
a report. The walk does not enter a link to a folder, because the link is the item that the
install handles. It skips each entry that is named `.git` or `node_modules`.

A link that leaves the plugin and stays in the marketplace is for
[`plugin-symlink-escapes-plugin`](plugin-symlink-escapes-plugin.md). So one link gets one report
at most. The rule [`marketplace-entry-component-paths`](marketplace-entry-component-paths.md)
reports a component path of a marketplace entry that leads out through a link. It reads
`marketplace.json`. This rule reads the plugin, and reports the link itself.

The rule makes no report in these cases:

- The target is in the plugin or in the marketplace.
- The link has no target, or the link is a loop.
- The target is out of the repository. The rule reads no file out of the repository.
- A folder of the plugin cannot be listed. The rule skips that folder and still reads the others.
- A `marketplace.json` above the plugin cannot be read. It can be a link with no target, or a
  link out of the repository.
- The rule cannot see the plugin. The plugin root can be unseen. The real path of the plugin
  root, of `.claude-plugin/` or of `plugin.json` can be out of the repository. The manifest can
  fail to parse.

Fail: a plugin in `site/plugins/p/` with a link `skills/shared` to `../../../../shared`, in a
repository where the marketplace root is `site/`. The target is `shared` at the repository root.

Pass: the same link, with the target `site/shared`. Then the other rule reports it, as a warning.

## Options

None.

## Sources

[^symlinks]: [Host and maintain a marketplace: Share files within a marketplace with symlinks](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks)
