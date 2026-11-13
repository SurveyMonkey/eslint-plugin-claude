// The `minVersion` option of the rules that check a Claude Code version. A
// rule with this option reports only when the option is set and is lower
// than the version that fixed the problem. With no option, the rule is
// inactive, because the file does not show which versions its users run.

/** The options of such a rule. */
export type MinVersionOptions = [{ minVersion?: string }]
