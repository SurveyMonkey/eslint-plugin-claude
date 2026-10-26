// The models that the auto mode classifier does not use when `CLAUDE_CODE_AUTO_MODE_MODEL` names
// them. Source: the table "When your model doesn't review" under "Choose the classifier model"
// (https://code.claude.com/docs/en/permission-modes#choose-the-classifier-model). The table says
// that the default classifier model reviews when you set Claude Opus 5, Sonnet 5.5 or Opus 5.5.
// Claude Code owns this list, and it can change with each model release.
// Checked on Claude Code 2.1.310 on 2026-10-25. Review the list on or before 2027-04-25, the
// `stale_after` date of docs/rules/settings-env-auto-mode-model.md.
import type { ModelVersion } from './models.ts'

/** The models that the classifier ignores, as family and version. */
const IGNORED_CLASSIFIER_MODELS: readonly ModelVersion[] = [
  { family: 'opus', major: 5, minor: 0 },
  { family: 'sonnet', major: 5, minor: 5 },
  { family: 'opus', major: 5, minor: 5 },
]

/** True when the classifier ignores `model` and uses its default model. */
export const isIgnoredClassifierModel = (model: ModelVersion) =>
  IGNORED_CLASSIFIER_MODELS.some(
    (ignored) =>
      ignored.family === model.family &&
      ignored.major === model.major &&
      ignored.minor === model.minor,
  )
