// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShiftPageClient } from '@/features/shift/client/ShiftPageClient'
import type { ClientShiftRecord } from '@/features/shift/domain/persistence'
import { createStoredShiftRecord } from '../helpers/shift-fixtures'

const replaceMock = vi.fn()

let sessionStatus: 'authenticated' | 'loading' | 'unauthenticated' = 'loading'
let sessionData:
  | { user?: { convexToken?: string; githubUsername?: string } }
  | null = null
let liveShiftRecord: ClientShiftRecord | null | undefined

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock
  })
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: sessionData,
    status: sessionStatus
  })
}))

vi.mock('@/features/shift/client/convex-api', () => ({
  useShiftRecord: () => liveShiftRecord
}))

vi.mock('@/features/shift/client/ShiftConsole', () => ({
  default: ({ shift }: { shift: { id: string } }) => <div>Shift console {shift.id}</div>
}))

function setUserAgent (value: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value
  })
}

function toClientShiftRecord (): ClientShiftRecord {
  const { seed: _seed, ...record } = createStoredShiftRecord()
  return record
}

describe('ShiftPageClient', () => {
  beforeEach(() => {
    cleanup()
    replaceMock.mockReset()
    sessionStatus = 'loading'
    sessionData = null
    liveShiftRecord = undefined
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading shell while the auth session is hydrating', () => {
    render(<ShiftPageClient shiftId='shift_123' />)

    expect(screen.getByText('Patching you through…')).toBeTruthy()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated users to the landing page', async () => {
    sessionStatus = 'unauthenticated'
    sessionData = null

    render(<ShiftPageClient shiftId='shift_123' />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })

  it('redirects authenticated mobile users to the landing page', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { convexToken: 'token', githubUsername: 'operator' } }
    setUserAgent('iPhone')

    render(<ShiftPageClient shiftId='shift_123' />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })

  it('redirects when the session is missing the Convex token', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { githubUsername: 'operator' } }

    render(<ShiftPageClient shiftId='shift_123' />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })

  it('redirects when the owned shift query resolves null', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { convexToken: 'token', githubUsername: 'operator' } }
    liveShiftRecord = null

    render(<ShiftPageClient shiftId='shift_123' />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
  })

  it('renders the shift console once the owned shift query resolves', async () => {
    sessionStatus = 'authenticated'
    sessionData = { user: { convexToken: 'token', githubUsername: 'operator' } }
    liveShiftRecord = toClientShiftRecord()

    render(<ShiftPageClient shiftId='shift_123' />)

    expect(await screen.findByText('Shift console shift_123')).toBeTruthy()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
