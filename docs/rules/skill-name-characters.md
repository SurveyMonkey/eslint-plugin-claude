---
type: Reference
description: The ESLint rule claude/skill-name-characters, which reports a skill folder, a command file or folder, or a frontmatter name that holds a character Claude Code refuses, such as a zero-width space, a control character, an extra blank or an angle bracket.
owner: brianespinosa
created: 2026-10-14
related_issues: [304, 330]
stale_after: 2027-04-14
generated:
  by: claude-code
  at: 2026-10-14T00:00:00Z
---

# claude/skill-name-characters

📝 Do not put a character that Claude Code refuses in a skill or command name.

💼 This rule is enabled in the following configs: ✅ `recommended`, 🔒 `strict`.

<!-- end auto-generated rule header -->

| Category | Files                                |
| -------- | ------------------------------------ |
| load     | `**/SKILL.md`, `**/commands/**/*.md` |

## Rule details

Claude Code refuses a command name or a frontmatter `name` that holds characters such as
these:[^characters][^refused]

- A zero-width space (U+200B), or a control character (`Cc`). The rule also counts U+FEFF, because
  its Unicode name is ZERO WIDTH NO-BREAK SPACE.
- A private-use character (`Co`), such as a glyph from an icon font, or an unassigned character
  (`Cn`).
- A character that changes the text direction (`Bidi_Control`).
- A blank that is not a plain space, such as a no-break space. A plain space is also a fault at
  the start or the end of the name, or next to another space.
- `<` or `>`.

The startup notice of Claude Code adds this: a name may not hold "hidden, direction-changing or
blank-like characters".[^refused] The docs give no list of the hidden and blank-like characters.
The rule takes two more classes from a probe of Claude Code 2.1.319. The probe made a project
skill folder `x<c>y` for each of a set of sample characters. Claude Code refused each sample. The
rule extends the samples to these two classes:

- A hidden character: a format character (`Cf`), or a default-ignorable code point
  (`Default_Ignorable_Code_Point`). The samples include these characters:
  - a soft hyphen (U+00AD) and a word joiner (U+2060)
  - a zero-width joiner (U+200D) and a zero-width non-joiner (U+200C)
  - the variation selectors U+FE00, U+FE0E and U+FE0F, and U+034F
  - the Hangul fillers U+115F and U+3164
- A blank-like character: U+2800 (braille pattern blank), U+FFFC (object replacement character),
  U+1D159 (musical symbol null notehead), U+13441 and U+13442 (Egyptian hieroglyph full blank and
  half blank), and U+16FE4 (Khitan small script filler).

The rule refuses each character of the two classes, also one that the probe did not try. The
probe also showed that Claude Code takes these characters near the classes: U+2801, U+FFFD,
U+2423, U+2588, U+1D158, U+1D15A, U+2FFF, U+0301 after `x`, U+05D0 and U+1F600. The rule reports no
character outside the classes above and the 2.1.322 rules below.

Claude Code 2.1.319 took some characters of the hidden class in a probe. Revision 38 of UAX #31
gives contexts for some of them.[^uax31-38] Revision 39 and later do not hold these contexts.
The current UAX #31 says: "The joining controls are used in the
orthographies of some languages, as well as in emoji ZWJ sequences."[^uax31] The rule takes
these characters in the cases below. Each limit that no Unicode source gives is a choice of the
rule, set from probes of Claude Code 2.1.319.

- An emoji sequence of the RGI emoji set.[^rgi] UAX #31 revision 38 says: "Implementations that
  allow emoji characters in identifiers should also normally allow emoji sequences."[^uax31-38]
  Examples are a family of people joined with U+200D, and a red heart with U+FE0F. A keycap and
  the flag of England are two more.
  - Probes only: Claude Code refused the sequence when a mark or a Hangul jamo came after it.
    It also refused U+FE0F before a skin tone. The rule reports the first hidden character of
    the sequence in these cases.
- A joiner between two consonants of one Indic script, after the virama. Contexts A2 and B of
  UAX #31 revision 38 take a joiner after a letter and a virama.[^uax31-38] The consonants are
  the `Indic_Syllabic_Category` Consonant characters at offsets 0x15 to 0x39 of the
  block.[^isc] A nukta can come before the virama.
  - Probes only: the probe took U+200C or U+200D in each of Devanagari, Bengali, Gujarati,
    Oriya, Telugu, Kannada and Malayalam. It refused a joiner after a Tamil virama, before a
    Latin letter, before a vowel sign, and between two scripts. It refused a joiner after a
    virama on a vowel letter or on a Latin letter. It also refused a joiner before
    U+0958 or U+0D3A, which are consonants outside the range.
  - The rule takes no nukta in Malayalam, because U+0D3C is a Pure_Killer there.[^isc] The
    probe refused a joiner after U+0D3C.
- U+200D between two Sinhala consonants, after the virama. A2 also takes U+200C there, but the
  probe refused it.
- U+200C between two Arabic letters (context A1).[^uax31-38] The letter before has
  `Joining_Type` Dual_Joining or Left_Joining. The letter after has Dual_Joining or
  Right_Joining.[^joining] The two lists hold the Arabic letters from U+0620 to U+08C8.
  - Probes only: the lists leave out U+10EC2 to U+10EC4. The probe refused U+200C after U+10EC3,
    and before U+10EC2.
  - Probes only: A1 takes any number of Transparent characters next to U+200C. The rule takes up
    to eight Arabic or inherited non-spacing marks after the first letter. The probe took eight
    marks, and refused nine and a Devanagari nukta.

Claude Code refused a joiner outside these cases. Examples are U+200C between two Latin letters,
U+200D after a Tamil virama, and U+200C after a Sinhala virama. Others are a joiner before a Latin
letter, a joiner between two scripts and U+200D between Arabic letters. It also refused a red
heart with U+FE0E. The rule reports each one. A probe of Claude Code 2.1.322 gave the same result for each
joiner case of these lists.

A probe of Claude Code 2.1.322 gives the rules below. The probe made a project skill folder for
each of a set of names. No public source gives these limits, so each one is a choice of the rule.

- U+20E3 (combining enclosing keycap) outside a keycap emoji of the RGI set. The probe refused
  it after a letter, a digit or a mark, and at the start. It took U+20DD, U+20DE, U+20DF,
  U+20E0, U+20E2 and U+20E4 after `a`.
- A lone surrogate in a frontmatter `name`, such as the YAML escape `"\uD800"`. Claude Code
  could not read such a value. It then ignored all of the frontmatter, and the skill loaded with
  its folder name. A folder name cannot hold a lone surrogate.
- A combining mark (`M`) with no letter or number (`L` or `N`) before it. The probe refused a
  mark at the start. It also refused a mark after a space, a hyphen, `.`, `_`, `:`, `!`, `$`,
  `^`, U+FFFD or an emoji. The rule counts a Hangul vowel or final jamo as a mark.
- More than eight marks after one letter or number. The probe took eight, and refused nine.
- A mark outside the Inherited script, after a character of the Latin or the Common script. The
  probe refused U+05B8 (Hebrew), U+093F (Devanagari) and U+1161 (Hangul) after `a`. It refused
  U+093F after `1` and after U+00B2. It took each probed Inherited mark after `a`, such as U+0301
  and U+064B. It also took each probed mark after a letter that is not Latin, such as U+093F
  after a Bengali letter.

The rule reports the first refused character. A joiner is not a letter, so the rule also refuses
a mark after a refused joiner. The message then escapes both.

The rule reports these cases:

- A skill folder in `.claude/skills/`. Claude Code does not load the skill. Rename the folder.
- A command file, or a folder below `commands/`. Claude Code does not load the command. Rename
  the file or the folder. The name of a file is its name without `.md`.
- The frontmatter `name` of a skill. The skill loads. But the `/` menu does not show the `name`
  value, and the value does not invoke the skill. Edit the `name` field.

The message gives the first character that Claude Code refuses, by its code point. The name in
the message shows each refused character as `<U+XXXX>`. So a direction control or a zero-width
space cannot hide in the text.

The rule does not report a folder in the `skills/` directory of a plugin. Claude Code changes the
characters to hyphens in the command name of such a skill, and the skill loads.[^characters] It
still reports the `name` field of a plugin skill, and the file or folder name of a plugin command.

The docs give examples, not a full list. The rule does not read the `name` field of a command
file. A command gets its name from its path, and the docs give the `name` effect for a skill only.

Claude Code also refuses a name over 256 characters.[^refused] The rule reports this length
fault, with no option: the limit is fixed. The docs do not say how Claude Code counts
characters. The rule counts code points.

- A frontmatter `name` of a skill is one name.
- The name of a command is its folders and its file name, joined with `:`. The docs do not say
  if the limit applies to this joined name or to each part. The rule uses the joined name, which
  is the longer count. A part over 256 characters cannot be on disk, so only the joined name
  can be over the limit. The rule does not add the plugin name to a plugin command name.
- A skill folder name is not checked for length. A folder name of 256 bytes or more cannot exist.
- The rule gives one report for each name over the limit. A name that also holds a refused
  character gets both reports.

The rule does not read the plugin manifest. So it does not check a skill or command at a
manifest `skills` or `commands` path. When a manifest `commands` key replaces `commands/`,
Claude Code does not load the files there. The rule still reports them.

The rule checks the files that the other skill rules check:

- `.claude/skills/<name>/SKILL.md`
- `<plugin>/skills/<name>/SKILL.md`, for the `name` field only
- `<plugin>/SKILL.md`, for the `name` field only
- `.claude/commands/**/*.md`
- `<plugin>/commands/**/*.md`

Fail: `.claude/skills/deploy<prod>/SKILL.md`, `.claude/commands/run  tests.md`, a `SKILL.md`
with `name: " deploy"`, and a `SKILL.md` with a `name` of 257 characters.

Pass: a `SKILL.md` with a `name` of 256 characters, `.claude/skills/deploy app/SKILL.md`, and
`plugins/ops/skills/deploy<prod>/SKILL.md` with a manifest in `plugins/ops/.claude-plugin/`.

## Usage

Put the rule in `rules`, in the config block that extends `claude/recommended`. See
[Usage](../../README.md#usage) in the README.

```js
'claude/skill-name-characters': 'error'
```

## Sources

[^characters]: [Extend Claude with skills: Characters a skill name can't hold](https://code.claude.com/docs/en/skills#characters-a-skill-name-cant-hold)
[^refused]: [Error reference: Skill or command name refused](https://code.claude.com/docs/en/errors#skill-or-command-name-refused)
[^uax31]: [UAX #31: Unicode Identifiers and Syntax: Layout and Format Control Characters](https://www.unicode.org/reports/tr31/#Layout_and_Format_Control_Characters)
[^uax31-38]: [UAX #31 revision 38: Limited Contexts for Joining Controls](https://www.unicode.org/reports/tr31/tr31-38.html#Limited_Contexts_for_Joining_Controls)
[^rgi]: [UTS #51: Unicode Emoji: ED-27 RGI emoji set](https://www.unicode.org/reports/tr51/#def_rgi_set)
[^isc]: [Unicode Character Database: IndicSyllabicCategory.txt](https://www.unicode.org/Public/UCD/latest/ucd/IndicSyllabicCategory.txt)
[^joining]: [Unicode Character Database: DerivedJoiningType.txt](https://www.unicode.org/Public/UCD/latest/ucd/extracted/DerivedJoiningType.txt)
