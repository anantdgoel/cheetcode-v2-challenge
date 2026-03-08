# Engine Config

The engine is configured in three files:

- `src/core/engine/config/constants.ts`
- `src/core/engine/config/profiles.ts`
- `src/core/engine/config/balance.ts`

## How The Board Is Generated

`createBoard(seed)` produces the hidden board facts only:

- board profile
- hidden line family per line
- visible-to-hidden family permutation
- visible noise rate
- line quality, soft-cap, slope, maintenance offsets
- final-only phase change

Traffic plans, observations, and artifacts are derived later from the same board.

## Visible Signal Design

Visible switch marks and tags are weighted in `profiles.ts`.

- `FAMILY_SWITCH_MARK_WEIGHTS` controls which switch marks cluster around each visible family
- `FAMILY_TAG_WEIGHTS` does the same for class tags
- `FAMILY_COMPATIBILITY_BASE` defines the hand-authored compatibility anchor points

`balance.ts > visibleSignal` controls how noisy or faithful that public signal is.

## Traffic Generation

`balance.ts > trafficShape` controls:

- probe/final durations
- baseline pressure and bursts
- final-only phase change timing and magnitude
- arrival counts and spacing
- route mix multipliers
- observation log volume and noise

If a board feels too easy or too chaotic, start here before changing runtime math.

## Runtime, Scoring, Faults, And Drops

`balance.ts > runtimePenalties` controls:

- live load calculation
- service durations
- overload penalties
- premium misuse penalty
- connection probability conversion
- hold thresholds and post-plan drain horizon

`constants.ts` defines the stable drop thresholds and title thresholds.

`balance.ts > scoring` and `constants.ts > SCORE_WEIGHTS` together define:

- desk condition labels for probe summaries
- hidden score weighting
- title cutoffs

## Safe Tuning Order

When making balance changes:

1. Adjust `trafficShape` first if the desk feels too quiet or too brutal.
2. Adjust `visibleSignal` if inference is too obvious or too opaque.
3. Adjust `runtimePenalties` only when the routing law itself feels wrong.
4. Adjust scoring last, after the underlying gameplay feels right.

## Benchmark Workflow

Use the benchmark-oriented tests and agent scripts to validate changes:

- starter policy should remain weak
- baseline agent should stay in the mid band
- hiring-bar agent should stay strong but not perfect

For any balance change, compare:

- efficiency mean / median / min / max
- hidden score mean / median / min / max
- variance across the benchmark seed suite
