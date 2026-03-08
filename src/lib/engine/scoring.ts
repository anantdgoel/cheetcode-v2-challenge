import type { Title } from '@/lib/domain/game'
import { SCORE_WEIGHTS, TITLE_THRESHOLDS } from './config/constants'
import { GAME_BALANCE } from './config/balance'
import { clamp } from './shared'

function getHoldRate (totalHoldSeconds: number, totalCalls: number) {
  if (!totalCalls) return 0
  return clamp(
    totalHoldSeconds / (totalCalls * GAME_BALANCE.runtimePenalties.queueHoldDenominator),
    0,
    1
  )
}

/** Convert raw run outcomes into the hidden score used for titles and ranking. */
export function computeHiddenScore (params: {
  connectedCalls: number;
  totalCalls: number;
  droppedCalls: number;
  totalHoldSeconds: number;
  trunkMisuseCount: number;
}) {
  const totalCalls = Math.max(params.totalCalls, 1)
  const connectRate = params.connectedCalls / totalCalls
  const dropRate = params.droppedCalls / totalCalls
  const holdRate = getHoldRate(params.totalHoldSeconds, totalCalls)
  const trunkDiscipline = 1 - params.trunkMisuseCount / totalCalls
  return clamp(
    connectRate * SCORE_WEIGHTS.connectRate +
      (1 - dropRate) * SCORE_WEIGHTS.dropRate +
      (1 - holdRate) * SCORE_WEIGHTS.holdRate +
      trunkDiscipline * SCORE_WEIGHTS.trunkDiscipline,
    0,
    1
  )
}

export function getTitleForScore (score: number): Title {
  return TITLE_THRESHOLDS.find((entry) => score > entry.minScore)?.title ?? 'off_the_board'
}
