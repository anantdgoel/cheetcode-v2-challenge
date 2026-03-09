// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminCandidatePage } from '@/core/domain/views'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams()
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
    page: 0,
    totalPages: 1,
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

  it('does not show pagination when only one page', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage()} />)

    expect(screen.queryByText('Previous')).toBeNull()
    expect(screen.queryByText('Next')).toBeNull()
  })

  it('shows pagination controls for multiple pages', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ totalPages: 3 })} />)

    expect(screen.getByText('Page 1 of 3')).toBeTruthy()
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
  })

  it('disables Previous button on first page', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ totalPages: 3, page: 0 })} />)

    const prevButton = screen.getByText('Previous')
    expect((prevButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('navigates to next page', async () => {
    const { AdminTableView } = await import('@/features/admin/client/AdminTableView')
    render(<AdminTableView data={makePage({ totalPages: 3, page: 0 })} />)

    fireEvent.click(screen.getByText('Next'))

    expect(pushMock).toHaveBeenCalledWith('/admin?page=1')
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
