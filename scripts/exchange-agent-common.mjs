/**
 * exchange-agent-common.mjs — Shared constants and utilities for agent scripts
 *
 * These constants and functions are also declared (not imported) in
 * exchange-agent-runtimes.mjs for toString() serialization into QuickJS
 * policy source. When modifying shared logic, update both files.
 */
export const ROUTE_CODES = ['local', 'intercity', 'relay', 'priority']
export const BILLING_MODES = ['standard', 'verified', 'collect']
export const URGENCIES = ['routine', 'priority']
export const VISIBLE_FAMILIES = ['district', 'relay', 'trunk', 'exchange', 'suburban']
export const CALL_KEY_COUNT = ROUTE_CODES.length * BILLING_MODES.length * URGENCIES.length

export const FAMILY_MARKS = {
  district: ['D-4', 'N-2', 'B-3', 'C-9'],
  relay: ['L-5', 'H-6'],
  trunk: ['T-1', 'P-7', 'M-4'],
  exchange: ['P-7', 'H-6', 'C-9'],
  suburban: ['D-4', 'L-5', 'B-3']
}

export const FAMILY_TAGS = {
  district: ['residential', 'street', 'borough', 'meter', 'ledger'],
  relay: ['transit', 'junction', 'hotel'],
  trunk: ['continental', 'commercial', 'trunk'],
  exchange: ['government', 'desk', 'junction', 'continental', 'ledger'],
  suburban: ['street', 'borough', 'junction', 'commercial', 'meter']
}

export function premiumEligible (call) {
  return (
    (call.routeCode === 'intercity' && call.billingMode === 'verified') ||
    (call.routeCode === 'priority' && call.urgency === 'priority')
  )
}

export function loadBandForLoad (load) {
  if (load >= 0.8) return 'peak'
  if (load >= 0.62) return 'high'
  if (load >= 0.38) return 'medium'
  return 'low'
}

export function classifyVisibleFamily (line) {
  const scores = {}
  for (const family of Object.keys(FAMILY_MARKS)) {
    const tagMatches = line.classTags.filter((tag) => FAMILY_TAGS[family].includes(tag)).length
    const markMatch = FAMILY_MARKS[family].includes(line.switchMark) ? 1.6 : 0
    scores[family] = tagMatches * 1.05 + markMatch + (line.isPremiumTrunk && family === 'trunk' ? 0.25 : 0)
  }
  return Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'district'
}

export function familyRouteBias (hiddenFamily, call) {
  if (hiddenFamily === 'district') {
    if (call.routeCode === 'local') return 0.68
    if (call.routeCode === 'priority') return 0.08
    return -0.28
  }
  if (hiddenFamily === 'relay') {
    if (call.routeCode === 'relay') return 0.64
    if (call.billingMode === 'collect') return 0.18
    if (call.routeCode === 'priority') return 0.16
    return -0.12
  }
  if (hiddenFamily === 'trunk') {
    if (call.routeCode === 'intercity') return call.billingMode === 'verified' ? 0.8 : 0.44
    if (call.routeCode === 'priority') return call.urgency === 'priority' ? 0.6 : 0.22
    return -0.22
  }
  if (hiddenFamily === 'exchange') {
    if (call.routeCode === 'priority') return call.billingMode === 'verified' ? 0.82 : 0.62
    if (call.billingMode === 'verified') return 0.24
    if (call.subscriberClass === 'government') return 0.22
    return -0.1
  }
  if (call.routeCode === 'local') return call.billingMode === 'collect' ? 0.54 : 0.46
  if (call.routeCode === 'relay') return 0.36
  if (call.routeCode === 'intercity' && call.urgency === 'routine') return 0.22
  return -0.08
}

export function routeIndexFor (routeCode) {
  return ROUTE_CODES.indexOf(routeCode)
}

export function billingIndexFor (billingMode) {
  return BILLING_MODES.indexOf(billingMode)
}

export function urgencyIndexFor (urgency) {
  return URGENCIES.indexOf(urgency)
}

export function callKeyIndex (call) {
  const routeIndex = routeIndexFor(call.routeCode)
  const billingIndex = billingIndexFor(call.billingMode)
  const urgencyIndex = urgencyIndexFor(call.urgency)
  if (routeIndex < 0 || billingIndex < 0 || urgencyIndex < 0) return 0
  return routeIndex * (BILLING_MODES.length * URGENCIES.length) + billingIndex * URGENCIES.length + urgencyIndex
}
