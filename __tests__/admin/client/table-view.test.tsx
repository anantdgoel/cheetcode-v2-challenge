// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminCandidatePage } from '@/core/domain/views'

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
  pushMock.mockReset()
})

function makePage (overrides: Partial<AdminCandidatePage> = {}): AdminCandidatePage {
  return {
    rows: [
      {
        github: 'alice',
        title: 'chief_operator',
        hiddenScore: 95,
        boardEfficiency: 0.92,
        achievedAt: Date.now() - 3600000,
        publicId: 'pub_alice',
        shiftCount: 5,
        hasContact: true,
        lastActive: Date.now() - 600000
      },
      {
        github: 'bob',
        title: 'operator',
        hiddenScore: 50,
        boardEfficiency: 0.55,
        achievedAt: Date.now() - 7200000,
        publicId: 'pub_bob',
        shiftCount: 1,
        hasContact: false,
        lastActive: Date.now() - 86400000
      }
    ],
    totalEntries: 2,
    startRank: 0,
    nextCursor: null,
    isDone: true,
    ...overrides
  }
}

describe('AdminTableView', () => {
  it('renders heading and candidate count', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    expect(screen.getByText('Candidate Board')).toBeTruthy()
    expect(screen.getByText('2 candidates')).toBeTruthy()
  })

  it('renders all candidate rows', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    expect(screen.getByText('alice')).toBeTruthy()
    expect(screen.getByText('bob')).toBeTruthy()
    expect(screen.getByText('Chief Operator')).toBeTruthy()
    expect(screen.getByText('Operator')).toBeTruthy()
  })

  it('shows efficiency and score', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    expect(screen.getByText('92%')).toBeTruthy()
    expect(screen.getByText('95')).toBeTruthy()
    expect(screen.getByText('55%')).toBeTruthy()
    expect(screen.getByText('50')).toBeTruthy()
  })

  it('shows shift counts in the correct column', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    const shiftCells = document.querySelectorAll('.col-shifts')
    // First is the header, then one per row
    const values = Array.from(shiftCells).slice(1).map((el) => el.textContent)
    expect(values).toEqual(['5', '1'])
  })

  it('navigates to candidate detail on row click', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    fireEvent.click(screen.getByText('alice'))

    expect(pushMock).toHaveBeenCalledWith('/admin?candidate=alice')
  })

  it('shows Next button disabled when isDone', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ isDone: true, nextCursor: null })} />)

    const nextButton = screen.getByText('Next')
    expect((nextButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows Next button enabled when not isDone', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ isDone: false, nextCursor: 'cursor123' })} />)

    const nextButton = screen.getByText('Next')
    expect((nextButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not show First page link on first page', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ startRank: 0 })} />)

    expect(screen.queryByText('← First page')).toBeNull()
  })

  it('navigates to next page with cursor', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ isDone: false, nextCursor: 'cursor_abc', startRank: 0 })} />)

    fireEvent.click(screen.getByText('Next'))

    expect(pushMock).toHaveBeenCalledWith('/admin?cursor=cursor_abc&start=2')
  })

  it('renders contact dot for candidates with contact', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    const yesDots = document.querySelectorAll('.contact-dot--yes')
    const noDots = document.querySelectorAll('.contact-dot--no')
    expect(yesDots).toHaveLength(1)
    expect(noDots).toHaveLength(1)
  })
})
