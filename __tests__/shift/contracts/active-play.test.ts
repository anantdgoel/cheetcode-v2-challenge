import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  redirectMock,
  headersMock,
  getGithubUsernameMock,
  getOwnedShiftForGithubMock,
  saveDraftForGithubMock,
  getArtifactForShiftMock,
  isDesktopUserAgentMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`)
  }),
  headersMock: vi.fn(),
  getGithubUsernameMock: vi.fn(),
  getOwnedShiftForGithubMock: vi.fn(),
  saveDraftForGithubMock: vi.fn(),
  getArtifactForShiftMock: vi.fn(),
  isDesktopUserAgentMock: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock
}))

vi.mock('next/headers', () => ({
  headers: headersMock
}))

vi.mock('@/server/auth/github', () => ({
  getGithubUsername: getGithubUsernameMock
}))

vi.mock('@/features/shift/server', () => ({
  getOwnedShiftForGithub: getOwnedShiftForGithubMock,
  saveDraftForGithub: saveDraftForGithubMock,
  getArtifactForShift: getArtifactForShiftMock
}))

vi.mock('@/server/http/user-agent', () => ({
  isDesktopUserAgent: isDesktopUserAgentMock
}))

describe('active play desktop gating', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('redirects mobile users away from the active Shift page', async () => {
    headersMock.mockResolvedValue(new Headers({ 'user-agent': 'iPhone' }))
    getGithubUsernameMock.mockResolvedValue('operator')
    isDesktopUserAgentMock.mockReturnValue(false)

    const { default: ShiftPage } = await import('@/app/shift/[shiftId]/page')

    await expect(
      ShiftPage({
        params: Promise.resolve({ shiftId: 'shift_123' })
      })
    ).rejects.toThrow('redirect:/')

    expect(redirectMock).toHaveBeenCalledWith('/')
    expect(getOwnedShiftForGithubMock).not.toHaveBeenCalled()
  })

  it('blocks mobile draft saves on shift-only routes', async () => {
    getGithubUsernameMock.mockResolvedValue('operator')
    isDesktopUserAgentMock.mockReturnValue(false)

    const { POST } = await import('@/app/api/shifts/[shiftId]/drafts/route')
    const response = await POST(
      new Request('http://localhost/api/shifts/shift_123/drafts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'iPhone'
        },
        body: JSON.stringify({ source: 'export function connect() { return { lineId: null }; }' })
      }),
      { params: Promise.resolve({ shiftId: 'shift_123' }) }
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Official play is desktop-only. Public reports remain browseable on mobile.'
    })
    expect(saveDraftForGithubMock).not.toHaveBeenCalled()
  })

  it('returns raw text for successful artifact fetches', async () => {
    getGithubUsernameMock.mockResolvedValue('operator')
    isDesktopUserAgentMock.mockReturnValue(true)
    getArtifactForShiftMock.mockResolvedValue({
      content: '# Manual\nRoute the calls.',
      type: 'text/markdown'
    })

    const { GET } = await import('@/app/api/shifts/[shiftId]/artifacts/[name]/route')
    const response = await GET(
      new Request('http://localhost/api/shifts/shift_123/artifacts/manual.md', {
        headers: { 'user-agent': 'Mozilla/5.0' }
      }),
      { params: Promise.resolve({ shiftId: 'shift_123', name: 'manual.md' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    await expect(response.text()).resolves.toBe('# Manual\nRoute the calls.')
  })
})
