// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import React from 'react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/landing/client/ConvexAuthProvider', () => ({
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => (
    React.createElement('div', { 'data-testid': 'convex-auth-provider' }, children)
  )
}))

vi.mock('@/features/shift/client/ShiftPageClient', () => ({
  ShiftPageClient: ({ shiftId }: { shiftId: string }) => (
    React.createElement('div', { 'data-testid': 'shift-page-client' }, shiftId)
  )
}))

describe('active shift page', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('renders the client-first shift shell inside the Convex auth provider', async () => {
    const { default: ShiftPage } = await import('@/app/shift/[shiftId]/page')
    render(await ShiftPage({
      params: Promise.resolve({ shiftId: 'shift_123' })
    }))

    expect(screen.getByTestId('convex-auth-provider')).toBeTruthy()
    expect(screen.getByTestId('shift-page-client').textContent).toBe('shift_123')
  })
})
