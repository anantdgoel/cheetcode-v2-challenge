import { describe, expect, it } from 'vitest'
import type { PolicyInput } from '../src/core/domain/game'
import { createBoard, simulateExchange, summarizeProbe } from '../src/core/engine'

function firstIdleDecision (input: PolicyInput) {
  const idle = input.lines.filter((line) => line.status === 'idle')
  return { lineId: idle[0]?.id ?? null }
}

function premiumGreedyDecision (input: PolicyInput) {
  const idle = input.lines.filter((line) => line.status === 'idle')
  if (!idle.length) return { lineId: null }
  return { lineId: idle.find((line) => line.isPremiumTrunk)?.id ?? idle[0]!.id }
}

function bestBoardBy (seeds: string[], score: (traits: ReturnType<typeof createBoard>['hiddenTraits']) => number) {
  return seeds
    .map((seed) => createBoard(seed))
    .sort((left, right) => score(right.hiddenTraits) - score(left.hiddenTraits))[0]!
}

const SEARCH_SEEDS = Array.from({ length: 48 }, (_, index) => `probe-vnext-${String(index + 1).padStart(2, '0')}`)

describe('probe rewrite evidence', () => {
  it('surfaces premium thrash on fragile boards when premium is overused', async () => {
    const board = bestBoardBy(SEARCH_SEEDS, (traits) => traits.premiumFragility)
    const result = await simulateExchange({
      board,
      mode: 'stress',
      decide: (input) => Promise.resolve(premiumGreedyDecision(input))
    })
    const summary = summarizeProbe(result, 'stress', board)

    expect(summary.failureModes).toContain('premium_thrash')
    expect(summary.modeConfidence.premium_thrash).toBeGreaterThan(0.3)
  })

  it('surfaces misleading history and transfer risk on boards with weak history and volatile finals', async () => {
    const board = bestBoardBy(
      SEARCH_SEEDS,
      (traits) => (1 - traits.historyReliability) * 0.7 + traits.finalShiftSensitivity * 0.3
    )
    const result = await simulateExchange({
      board,
      mode: 'stress',
      decide: (input) => Promise.resolve(firstIdleDecision(input))
    })
    const summary = summarizeProbe(result, 'stress', board)

    expect(summary.modeConfidence.misleading_history).toBeGreaterThan(0.45)
    expect(summary.counterfactualNotes.join(' ')).toMatch(/books|live room/i)
    expect(summary.transferWarning).toMatch(/stable|stress_only|likely_final_shift_sensitive/)
  })

  it('keeps probe prose evidence-shaped instead of solution-shaped', async () => {
    const board = bestBoardBy(
      SEARCH_SEEDS,
      (traits) => traits.pressureCollapse + traits.tempoLag + (1 - traits.historyReliability)
    )
    const result = await simulateExchange({
      board,
      mode: 'stress',
      decide: (input) => Promise.resolve(firstIdleDecision(input))
    })
    const summary = summarizeProbe(result, 'stress', board)
    const prose = [
      ...summary.chiefOperatorNotes,
      ...summary.counterfactualNotes,
      ...summary.recommendedQuestions
    ].join(' ')

    expect(prose).not.toMatch(/static_ranker|load_gated_ranker|guarded_hold_policy|premium_budget_policy/i)
    expect(prose).not.toMatch(/\b\d+(\.\d+)?\b/)
    expect(summary.recommendedQuestions.every((question) => /^(Does|Is|Are|Did)\b/.test(question))).toBe(true)
    expect(prose).not.toMatch(/\b(switch|set|use|add)\b/i)
  })
})
