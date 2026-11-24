# Decision records

Each file records one lasting decision about the plugin: the problem, what was decided, and what
follows from it. A replaced record stays here, marked "Superseded by ADR-n", and nothing may rely on it.
The "Replaces internal records" line at the end of each file names the planning notes it was condensed
from. Those notes were not published.

| ADR | Decision |
|---|---|
| [0001](0001-spec-driven-lifecycle.md) | Spec-driven lifecycle with two human approvals |
| [0002](0002-master-and-helper-agents.md) | A master session and a fixed roster of helper agents |
| [0003](0003-model-tiers.md) | Model tiers instead of model names |
| [0004](0004-project-settings-asked-at-setup.md) | One project settings file, every value asked at setup |
| [0005](0005-approval-by-exact-phrase.md) | Approvals are typed phrases recorded by a hook |
| [0006](0006-plan-gate-and-write-rights.md) | Plan gate and fixed write rights per helper |
| [0007](0007-verifier-integrity.md) | An independent verifier that builders can't game |
| [0008](0008-ledger-as-record.md) | The ledger is the one progress record |
| [0009](0009-hook-runtime-and-failure-modes.md) | Hooks: Node built-ins, safe failure per event, inert without settings |
| [0010](0010-optional-safety-copy.md) | An optional safety copy: "Never do" and "Ask first" |
| [0011](0011-context-manifests.md) | Context manifests: helpers get exactly the files they need |
| [0012](0012-retro-and-break-loop.md) | Learning through a retro with user-approved lessons |
| [0013](0013-spec-miner-baseline.md) | A baseline of what existing code does |
| [0014](0014-permission-prompts-and-allow-rules.md) | Fewer permission prompts, without weakening the checks |
| [0015](0015-how-the-plugin-is-tested.md) | How the plugin itself is tested |
| [0016](0016-packaging-and-releases.md) | Packaging, license and releases |
