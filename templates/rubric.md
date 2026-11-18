# Rubric — NNN-short-name

Written before building. The verifier scores every round against it; builders never edit it.
Pass = every acceptance criterion has evidence **and** the weighted score reaches the project's
`verification.passThreshold`.

## Evidence per acceptance criterion
| Criterion | Evidence needed | Signal |
|---|---|---|
| AC1.1 | test name passes; e.g. screenshot of the error message | code-only · browser · screenshot · logs |

## Scored criteria
Score 1–10 each. Weights add up to 100.

| Criterion | Weight | What a 10 looks like |
|---|---|---|
| Meets the spec | 40 | every criterion met, nothing extra built |
| Code quality | 20 | follows project standards, simple, no dead code |
| Tests | 20 | tests check behaviour, not internals; edge cases covered |
| Error handling | 10 | no swallowed errors, clear failure messages |
| Lenses (from project settings) | 10 | no findings from the active lenses |

## Signals available for this feature
Which of the project's signals the verifier can actually use here (e.g. browser not available → code-only).
