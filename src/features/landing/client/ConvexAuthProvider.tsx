'use client'

import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import { useSession } from 'next-auth/react'

let convexClient: ConvexReactClient | null = null

function getConvexClient () {
  if (convexClient) return convexClient
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!deploymentUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured')
  }
  convexClient = new ConvexReactClient(deploymentUrl)
  return convexClient
}

type SessionUser = {
  convexToken?: string;
  githubUsername?: string;
}

type DecodedJwtPayload = {
  exp?: number;
}

function parseJwtPayload (token: string): DecodedJwtPayload | null {
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return null

    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))
    ) as unknown

    if (!payload || typeof payload !== 'object') {
      return null
    }

    const candidate = payload as { exp?: unknown }
    return typeof candidate.exp === 'number' ? { exp: candidate.exp } : {}
  } catch {
    return null
  }
}

function useConvexAuth () {
  const { data: session, status, update } = useSession()
  const isLoading = status === 'loading'
  const user = session?.user as SessionUser | undefined
  const isAuthenticated = !!user?.convexToken

  const updateRef = useRef(update)
  useLayoutEffect(() => {
    updateRef.current = update
  })

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const currentToken = user?.convexToken ?? null
      if (!forceRefreshToken) {
        return currentToken
      }

      // forceRefreshToken: true — Convex is reconnecting or re-authenticating.
      // Only hit /api/auth/session if the current token is missing or about to expire.
      // Returning a still-valid token avoids unnecessary session polling.
      if (currentToken) {
        const payload = parseJwtPayload(currentToken)
        const nowSeconds = Date.now() / 1000
        if (payload?.exp && payload.exp - nowSeconds > 60) {
          return currentToken
        }
      }

      const refreshed = await updateRef.current()
      // Fall back to the current token if update() returns null (e.g. transient error)
      // rather than handing Convex a null and losing auth state.
      return (refreshed?.user as SessionUser | undefined)?.convexToken ?? currentToken
    },
    [user?.convexToken]
  )

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      fetchAccessToken
    }),
    [isLoading, isAuthenticated, fetchAccessToken]
  )
}

export function ConvexAuthProvider ({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={getConvexClient()} useAuth={useConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
