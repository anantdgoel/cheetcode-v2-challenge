'use client'

import { useEffect, useState } from 'react'
import type { ArtifactName } from '@/core/domain/game'
import type { ActiveTab } from '../types'
import { fetchArtifactContent } from '../api'

export function useShiftArtifacts (shiftId: string, activeTab: ActiveTab) {
  const [artifactContents, setArtifactContents] = useState<Partial<Record<ArtifactName, string>>>({})
  const artifactName = activeTab === 'editor' ? null : activeTab
  const artifactContent = artifactName ? artifactContents[artifactName] : undefined

  useEffect(() => {
    if (!artifactName || artifactContent) return

    let cancelled = false
    void fetchArtifactContent(shiftId, artifactName)
      .then((content) => {
        if (!cancelled) {
          setArtifactContents((current) => ({ ...current, [artifactName]: content }))
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setArtifactContents((current) => ({
            ...current,
            [artifactName]: error instanceof Error ? error.message : 'Artifact unavailable'
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [artifactContent, artifactName, shiftId])

  return artifactContents
}
