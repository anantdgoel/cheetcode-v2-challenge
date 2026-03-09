/**
 * v3-agent-policies.mjs — Public API for agent benchmark consumers
 *
 * This is the single import surface for runner scripts (run-*.mjs),
 * eval scripts (eval-*.mjs), and the user-flow harness. It re-exports from:
 *   - exchange-agent-models.mjs  (artifact parsing, model inference, priors)
 *   - exchange-agent-runtimes.mjs (decision functions, policy source generation)
 *
 * It also provides convenience wrappers that combine model inference with
 * runtime construction in a single call (e.g. createHiringBarDecision takes
 * raw artifacts and returns a ready-to-use decision function).
 *
 * Benchmark scripts should import from this file, not directly from
 * models or runtimes.
 */
import { buildPriorBoardSummary, inferHiringBarModelFromArtifacts } from './exchange-agent-models.mjs'
import {
  buildHiringBarPolicySourceFromModel,
  createHiringBarDecisionFromModel,
  createWarmStartDecisionFromModel,
  buildWarmStartPolicySourceFromModel
} from './exchange-agent-runtimes.mjs'
export { BENCHMARK_SEEDS, buildPriorBoardSummary, inferHiringBarModelFromArtifacts } from './exchange-agent-models.mjs'
export {
  buildOldHeuristicPolicySource,
  buildSnapshotPolicySource,
  buildWarmStartPolicySourceFromModel,
  oldHeuristicDecision,
  snapshotDecision
} from './exchange-agent-runtimes.mjs'

export function createHiringBarDecision (artifacts) {
  return createHiringBarDecisionFromModel(inferHiringBarModelFromArtifacts(artifacts))
}

export function buildHiringBarPolicySource (artifacts, tuning) {
  return buildHiringBarPolicySourceFromModel(inferHiringBarModelFromArtifacts(artifacts), tuning)
}

export function createWarmStartDecision (artifacts, priorArtifacts, tuning) {
  const model = inferHiringBarModelFromArtifacts(artifacts)
  const priorSummary = buildPriorBoardSummary(priorArtifacts)
  return createWarmStartDecisionFromModel(model, priorSummary, tuning)
}

export function buildWarmStartPolicySource (artifacts, priorArtifacts, tuning) {
  const model = inferHiringBarModelFromArtifacts(artifacts)
  const priorSummary = buildPriorBoardSummary(priorArtifacts)
  return buildWarmStartPolicySourceFromModel(model, priorSummary, tuning)
}
