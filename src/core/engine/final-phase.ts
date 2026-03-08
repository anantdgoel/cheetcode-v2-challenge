import { GAME_BALANCE } from './config/balance'
import type { FinalPhaseChange } from './models'

export function getShiftFactor (second: number, change: FinalPhaseChange) {
  const start = change.shiftPoint - GAME_BALANCE.trafficShape.finalPhaseChange.transitionWindowSeconds
  const end = change.shiftPoint + change.durationSeconds
  if (second <= start) return 0
  if (second >= end) return 1
  return (second - start) / Math.max(end - start, 1)
}
