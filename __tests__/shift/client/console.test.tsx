// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShiftConsole from '@/features/shift/client/ShiftConsole'
import type { ClientShiftRecord, StoredShiftRecord } from '@/features/shift/domain/persistence'
import type { ShiftView } from '@/core/domain/views'
import { shapeShiftView } from '@/features/shift/domain/view'
import { createProbeSummary, createShiftView, createStoredShiftRecord } from '../helpers/shift-fixtures'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock
  })
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>
}))

// Mock Convex API hooks — test controls these via the exported mocks
const mockValidateDraft = vi.fn()
const mockRunProbe = vi.fn()
const mockGoLive = vi.fn()
const mockSaveDraft = vi.fn()
const mockResolveShiftExpiry = vi.fn()

vi.mock('@/features/shift/client/convex-api', () => ({
  useMyCurrentShift: () => undefined,
  useArtifactContent: () => null,
  useStartShift: () => vi.fn(),
  useSaveDraft: () => mockSaveDraft,
  useValidateDraft: () => mockValidateDraft,
  useRunProbe: () => mockRunProbe,
  useGoLive: () => mockGoLive,
  useResolveShiftExpiry: () => mockResolveShiftExpiry
}))

const initialShift: ShiftView = createShiftView()

function toClientShiftRecord (record: StoredShiftRecord): ClientShiftRecord {
  const { seed: _seed, ...clientRecord } = record
  return clientRecord
}

function toShiftView (overrides: Partial<StoredShiftRecord> = {}): ShiftView {
  return shapeShiftView(
    toClientShiftRecord(createStoredShiftRecord(overrides)),
    Date.now()
  )
}

function ShiftConsoleHarness ({
  onReady,
  shift
}: {
  onReady: (setter: Dispatch<SetStateAction<ShiftView>> | null) => void;
  shift: ShiftView;
}) {
  const [liveShift, updateLiveShift] = useState(shift)

  useEffect(() => {
    onReady(updateLiveShift)
    return () => {
      onReady(null)
    }
  }, [onReady])

  return <ShiftConsole shift={liveShift} />
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  pushMock.mockReset()
  mockValidateDraft.mockReset()
  mockRunProbe.mockReset()
  mockGoLive.mockReset()
  mockSaveDraft.mockReset()
  mockResolveShiftExpiry.mockReset()
})

describe('ShiftConsole', () => {
  it('shows a calm early-phase clock cue before the room tightens', async () => {
    render(<ShiftConsole shift={initialShift} />)

    expect(await screen.findByText('Board open')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trial Shift \(2\)/ })).toBeTruthy()
  })

  it('debounces draft autosaves', async () => {
    vi.useFakeTimers()
    mockSaveDraft.mockResolvedValue(null)

    render(<ShiftConsole shift={initialShift} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editor' })[0]!)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: "export function connect() { return { lineId: 'line-1' }; }" }
    })

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(mockSaveDraft).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(mockSaveDraft).toHaveBeenCalledWith(
      'shift_123',
      "export function connect() { return { lineId: 'line-1' }; }"
    )
  })

  it('shows an editor notice when autosave fails', async () => {
    vi.useFakeTimers()
    mockSaveDraft.mockRejectedValue(new Error('Draft save failed'))

    render(<ShiftConsole shift={initialShift} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editor' })[0]!)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: "export function connect() { return { lineId: 'line-2' }; }" }
    })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    vi.useRealTimers()
    expect(await screen.findByText('Draft save failed')).toBeTruthy()
  })

  it('runs validate, probe, and go-live flows through the shared route contracts', async () => {
    const now = Date.now()
    let setLiveShift: Dispatch<SetStateAction<ShiftView>> | null = null

    mockValidateDraft.mockImplementation(async () => {
      setLiveShift?.(toShiftView({
        latestValidAt: now,
        latestValidSource: 'normalized',
        latestValidSourceHash: 'hash-1'
      }))
    })

    mockRunProbe.mockImplementation(async () => {
      setLiveShift?.(toShiftView({
        latestValidAt: now,
        latestValidSource: 'normalized',
        latestValidSourceHash: 'hash-1',
        runs: [{
          id: 'run_probe',
          kind: 'fit',
          trigger: 'manual',
          state: 'completed',
          acceptedAt: 100,
          resolvedAt: 200,
          sourceHash: 'hash-1',
          sourceSnapshot: 'snapshot',
          probeSummary: createProbeSummary()
        }]
      }))
      return { probeKind: 'fit' }
    })

    mockGoLive.mockImplementation(async () => {
      setLiveShift?.(toShiftView({
        state: 'completed',
        completedAt: now + 5000,
        reportPublicId: 'public_123',
        latestValidAt: now,
        latestValidSource: 'normalized',
        latestValidSourceHash: 'hash-1',
        runs: [
          {
            id: 'run_probe',
            kind: 'fit',
            trigger: 'manual',
            state: 'completed',
            acceptedAt: 100,
            resolvedAt: 200,
            sourceHash: 'hash-1',
            sourceSnapshot: 'snapshot',
            probeSummary: createProbeSummary()
          },
          {
            id: 'run_final',
            kind: 'final',
            trigger: 'manual',
            state: 'completed',
            acceptedAt: 300,
            resolvedAt: 400,
            sourceHash: 'hash-2',
            sourceSnapshot: 'snapshot',
            reportPublicId: 'public_123',
            title: 'operator',
            metrics: {
              connectedCalls: 8,
              totalCalls: 10,
              droppedCalls: 1,
              avgHoldSeconds: 1,
              totalHoldSeconds: 10,
              premiumUsageCount: 1,
              premiumUsageRate: 0.1,
              trunkMisuseCount: 0,
              efficiency: 0.8,
              hiddenScore: 0.75
            }
          }
        ]
      }))
    })

    render(<ShiftConsoleHarness onReady={(setter) => { setLiveShift = setter }} shift={initialShift} />)

    expect(screen.getByRole('button', { name: /Trial Shift \(2\)/ })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Validate/ }))
    expect(await screen.findByText('Module validated - ready to go live')).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: /Trial Shift \(2\)/ }))
    expect(await screen.findByText('Day room read complete.')).toBeTruthy()
    expect(await screen.findByText('Chief Operator Notes')).toBeTruthy()
    expect(await screen.findByText('Likely final-shift sensitive')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trial Shift \(1\)/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Go Live/ }))
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/public_123')
    })
  })

  it('keeps the trial action active while a second probe remains', async () => {
    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          latestValidAt: 25,
          canGoLive: true,
          probesUsed: 1,
          remainingProbes: 1,
          nextProbeKind: 'stress'
        }}
      />
    )

    expect(await screen.findByRole('button', { name: /Trial Shift \(1\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trial Shift \(1\)/ }).hasAttribute('disabled')).toBe(false)
  })

  it('shows zero trials after both probes are spent', async () => {
    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          latestValidAt: 25,
          canGoLive: true,
          probesUsed: 2,
          remainingProbes: 0,
          nextProbeKind: undefined
        }}
      />
    )

    expect(await screen.findByRole('button', { name: /Trial Shift \(0\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trial Shift \(0\)/ }).hasAttribute('disabled')).toBe(true)
  })

  it('redirects to the report after expiry auto-submits a valid draft', async () => {
    const now = Date.now()
    let setLiveShift: Dispatch<SetStateAction<ShiftView>> | null = null

    render(
      <ShiftConsoleHarness
        onReady={(setter) => { setLiveShift = setter }}
        shift={{
          ...initialShift,
          status: 'active_phase_2',
          phase1EndsAt: Date.now() - 30_000,
          latestValidAt: 25,
          latestValidSource: 'function connect() { return { lineId: null }; }',
          expiresAt: Date.now() - 1_000
        }}
      />
    )

    act(() => {
      setLiveShift?.(toShiftView({
        state: 'completed',
        completedAt: now,
        reportPublicId: 'public_auto',
        phase1EndsAt: now - 30_000,
        expiresAt: now - 1_000,
        latestValidAt: now - 2_000,
        latestValidSource: 'function connect() { return { lineId: null }; }',
        latestValidSourceHash: 'hash-auto',
        runs: [{
          id: 'run_auto',
          kind: 'final',
          trigger: 'auto_expire',
          state: 'completed',
          acceptedAt: now - 500,
          resolvedAt: now,
          sourceHash: 'hash-auto',
          sourceSnapshot: 'snapshot',
          reportPublicId: 'public_auto',
          title: 'operator',
          metrics: {
            connectedCalls: 8,
            totalCalls: 10,
            droppedCalls: 1,
            avgHoldSeconds: 1,
            totalHoldSeconds: 10,
            premiumUsageCount: 1,
            premiumUsageRate: 0.1,
            trunkMisuseCount: 0,
            efficiency: 0.8,
            hiddenScore: 0.75
          }
        }]
      }))
    })

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/report/public_auto')
    })
  })

  it('shows a live-room loading state while the final read is in progress', async () => {
    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          status: 'evaluating'
        }}
      />
    )

    expect(await screen.findByText('Chief operator reading your board')).toBeTruthy()
    expect(screen.getByText('Live Room Engaged')).toBeTruthy()
    expect(screen.getByText('Hold the line. Central Office is completing the final board read — your shift report will open automatically.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reading Board...' })).toBeTruthy()
  })

  it('requests expiry resolution when the countdown reaches zero', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T10:00:00.000Z'))
    mockResolveShiftExpiry.mockResolvedValue('scheduled_final')

    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          latestValidAt: Date.now() - 1_000,
          latestValidSource: 'function connect() { return { lineId: null }; }',
          expiresAt: Date.now() + 1_000
        }}
      />
    )

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(mockResolveShiftExpiry).toHaveBeenCalledWith('shift_123')
  })

  it('shows action errors ahead of stale validation errors', async () => {
    mockValidateDraft.mockRejectedValue(new Error('Route validation failed'))

    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          latestValidationError: 'Old validation error'
        }}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: /Validate/ }))

    expect(await screen.findByText('Route validation failed')).toBeTruthy()
    expect(screen.queryByText('Old validation error')).toBeNull()
  })

  it('warns about auto-submit during the final minute', async () => {
    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          status: 'active_phase_2',
          nextProbeKind: undefined,
          latestValidAt: 25,
          latestValidSource: 'function connect() { return { lineId: null }; }',
          canGoLive: true,
          expiresAt: Date.now() + 9_000
        }}
      />
    )

    expect(await screen.findByText('Last bell armed')).toBeTruthy()
    expect(
      await screen.findByText('Last bell. The last valid draft goes live at the whistle.')
    ).toBeTruthy()
  })

  it('closes the trial action in phase two', async () => {
    render(
      <ShiftConsole
        shift={{
          ...initialShift,
          status: 'active_phase_2',
          phase1EndsAt: Date.now() - 1_000,
          nextProbeKind: undefined,
          latestValidAt: 25,
          canGoLive: true
        }}
      />
    )

    expect(await screen.findByText('Trial floor closed')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Trial Floor Closed/ }).hasAttribute('disabled')).toBe(true)
  })
})
