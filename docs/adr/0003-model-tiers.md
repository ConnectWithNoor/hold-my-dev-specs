# ADR-0003 — Model tiers instead of model names

**Status:** Accepted (2026-11-18)

## Context
Model names change often, and the best choice depends on the user's plan and budget. A critic on the
same model as the builder tends to share its blind spots.

## Decision
- The plugin names **capability tiers**, never models:
  - `strongest`: verifier, test author, spec-miner (and the master session itself)
  - `mid`: implementer, explorer, shipper
- The tier-to-model map exists **only in the project settings**, asked at setup with no suggestion
  from the plugin. Setup offers the model names the Agent tool accepts, or tests another name once
  before saving it. If both tiers map to the same model, setup warns once: the critic should differ
  from the builder.
- **Enforced:** a hook on every helper start fills in the tier's model when the master didn't name one.
  A different model is kept, and the brief notes it (escalation on purpose).
- The test author stays on `strongest`, because the tests decide what counts as "correct", so a weaker
  test author weakens every later check. The sample run measured the cheaper alternative and kept this.

## Consequences
- The plugin needs no update when new models appear.
- Each project pays for the strong tier only where judgement matters.
- Tests check that no agent or skill file contains a model name.

**Replaces internal records:** D20 (critic on a different model), D36, B34, B41, B50 (tier).
