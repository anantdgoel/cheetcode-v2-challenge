'use client'

import type { ArtifactName } from '@/core/domain/game'
import type { ActiveTab } from '../types'
import { useArtifactContent } from '../convex-api'

export function useShiftArtifacts (shiftId: string, activeTab: ActiveTab) {
  const artifactName: ArtifactName | null = activeTab === 'editor' ? null : activeTab
  const content = useArtifactContent(shiftId, artifactName)

  const artifactContents: Partial<Record<ArtifactName, string>> = {}
  if (artifactName && typeof content === 'string') {
    artifactContents[artifactName] = content
  }

  return artifactContents
}
