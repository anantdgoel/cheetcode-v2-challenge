import type { ArtifactName } from '@/core/domain/game'
import { buildArtifactContent } from '@/core/engine/artifacts'
import { asShiftId, fetchInternalMutation, internal } from '@/server/convex/client'
import { shapeShiftView } from '../domain/view'
import { ensureResolvedShift } from './resolver'

const SHIFT_ARTIFACTS = [
  'manual.md',
  'starter.js',
  'lines.json',
  'observations.jsonl'
] as const satisfies readonly ArtifactName[]

const SHIFT_ARTIFACT_TYPES: Record<ArtifactName, string> = {
  'manual.md': 'text/markdown',
  'starter.js': 'text/javascript',
  'lines.json': 'application/json',
  'observations.jsonl': 'application/x-ndjson'
}

export async function getArtifactForShift (github: string, shiftId: string, name: string) {
  const shift = await ensureResolvedShift(github, shiftId)
  if (!shift) return null

  const view = shapeShiftView(shift, Date.now())
  if (view.status !== 'active_phase_1' && view.status !== 'active_phase_2') {
    return null
  }

  const artifactName = name as ArtifactName
  if (!SHIFT_ARTIFACTS.includes(artifactName)) {
    return null
  }

  await fetchInternalMutation(internal.sessions.recordArtifactFetch, {
    github,
    shiftId: asShiftId(shiftId),
    name: artifactName,
    at: Date.now()
  })

  return {
    content: buildArtifactContent(artifactName, shift.seed),
    type: SHIFT_ARTIFACT_TYPES[artifactName]
  }
}
