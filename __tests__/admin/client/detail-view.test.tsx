// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminCandidateDetail } from '@/core/domain/views'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock })
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { unoptimized: _, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />
  }
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makeDetail (overrides: Partial<AdminCandidateDetail> = {}): AdminCandidateDetail {
  return {
    github: 'alice',
    leaderboardRow: {
      github: 'alice',
      title: 'senior_operator',
      boardEfficiency: 0.78,
      hiddenScore: 72,
      achievedAt: Date.now(),
      publicId: 'pub_alice',
      shiftId: 'shift_1'
    },
    shifts: [{
      id: 'shift_1',
      state: 'completed',
      startedAt: Date.now() - 86400000,
      completedAt: Date.now() - 82800000,
      expiresAt: Date.now() - 79200000,
      runs: [{
        id: 'run_1',
        kind: 'fit',
        trigger: 'manual',
        state: 'completed',
        acceptedAt: Date.now() - 85000000,
        sourceSnapshot: 'function route(call, lines) { return lines[0]; }',
        metrics: {
          connectedCalls: 100,
          totalCalls: 120,
          droppedCalls: 20,
          avgHoldSeconds: 2.1,
          totalHoldSeconds: 210,
          premiumUsageCount: 5,
          premiumUsageRate: 0.04,
          trunkMisuseCount: 1,
          efficiency: 0.78,
          hiddenScore: 72
        }
      }]
    }],
    contact: null,
    summary: null,
    ...overrides
  }
}

describe('AdminDetailView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders candidate profile with github username', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    expect(screen.getByText('alice')).toBeTruthy()
    expect(screen.getByText('Senior Operator')).toBeTruthy()
  })

  it('shows back button that navigates to board', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    const backButton = screen.getByText(/Back to Board/)
    fireEvent.click(backButton)

    expect(pushMock).toHaveBeenCalledWith('/admin')
  })

  it('shows leaderboard stats', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    expect(screen.getByText('Best: 72 pts')).toBeTruthy()
    expect(screen.getByText('78% efficiency')).toBeTruthy()
    expect(screen.getByText('1 shift')).toBeTruthy()
  })

  it('shows contact card when contact exists', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(
      <AdminDetailView
        detail={makeDetail({
          contact: { name: 'Alice Smith', email: 'alice@example.com', submittedAt: Date.now() }
        })}
      />
    )

    expect(screen.getByText('Contact Info')).toBeTruthy()
    expect(screen.getByText(/Alice Smith/)).toBeTruthy()
    expect(screen.getByText(/alice@example.com/)).toBeTruthy()
  })

  it('does not show contact card when no contact', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    expect(screen.queryByText('Contact Info')).toBeNull()
  })

  it('shows cached LLM summary', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(
      <AdminDetailView
        detail={makeDetail({
          summary: {
            summary: 'SIGNAL: HIRE\nSTRENGTHS:\n- Strong iteration\nSUMMARY:\nGood candidate.',
            generatedAt: Date.now()
          }
        })}
      />
    )

    expect(screen.getByText('HIRE')).toBeTruthy()
    expect(screen.getByText(/Strong iteration/)).toBeTruthy()
    expect(screen.getByText('Regenerate')).toBeTruthy()
  })

  it('shows generate button when no summary', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    expect(screen.getByText('Generate Summary')).toBeTruthy()
    expect(screen.getByText(/No assessment generated/)).toBeTruthy()
  })

  it('calls API and displays generated summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ throttled: false, summary: 'SIGNAL: LEAN HIRE\nSUMMARY:\nDecent work.' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    fireEvent.click(screen.getByText('Generate Summary'))

    await waitFor(() => {
      expect(screen.getByText('LEAN HIRE')).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: 'alice' })
    })
  })

  it('shows error when generation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'API key missing' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    fireEvent.click(screen.getByText('Generate Summary'))

    await waitFor(() => {
      expect(screen.getByText('API key missing')).toBeTruthy()
    })
  })

  it('renders shift history with expandable shifts', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    expect(screen.getByText(/Shift History/)).toBeTruthy()
    const shiftHeader = screen.getByText(/^Shift\s+\d+$/)
    expect(shiftHeader).toBeTruthy()
    expect(screen.getByText('completed')).toBeTruthy()
  })

  it('expands shift to show runs', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    // Click to expand shift
    const shiftButton = screen.getByText(/^Shift\s+\d+$/).closest('button')!
    fireEvent.click(shiftButton)

    // Run details should be visible (run-kind has text-transform: uppercase in CSS, but DOM text is lowercase)
    expect(screen.getByText('fit')).toBeTruthy()
    expect(screen.getByText('manual')).toBeTruthy()
    expect(screen.getByText('View Policy Code')).toBeTruthy()
  })

  it('shows GitHub link', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')
    render(<AdminDetailView detail={makeDetail()} />)

    const link = screen.getByText(/GitHub →/)
    expect((link as HTMLAnchorElement).href).toBe('https://github.com/alice')
  })

  it('pluralizes shift count correctly', async () => {
    const { AdminDetailView } = await import('@/features/admin/client/AdminDetailView')

    const twoShifts = makeDetail({
      shifts: [
        makeDetail().shifts[0],
        { ...makeDetail().shifts[0], id: 'shift_2' }
      ]
    })
    render(<AdminDetailView detail={twoShifts} />)

    expect(screen.getByText('2 shifts')).toBeTruthy()
  })
})
