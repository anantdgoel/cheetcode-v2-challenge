import { beforeEach, describe, expect, it, vi } from 'vitest'

const getGithubUsernameMock = vi.fn()
const isAdminGithubMock = vi.fn()
const triggerSummaryGenerationMock = vi.fn()

vi.mock('@/server/auth/github', () => ({
  getGithubUsername: getGithubUsernameMock,
  isAdminGithub: isAdminGithubMock
}))

vi.mock('@/features/admin/server/queries', () => ({
  triggerSummaryGeneration: triggerSummaryGenerationMock
}))

function postSummary (body: unknown) {
  return new Request('http://localhost/api/admin/generate-summary', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/admin/generate-summary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 403 when user is not admin', async () => {
    getGithubUsernameMock.mockResolvedValue('random-user')
    isAdminGithubMock.mockReturnValue(false)

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({ github: 'candidate' }))

    expect(response.status).toBe(403)
    expect(triggerSummaryGenerationMock).not.toHaveBeenCalled()
  })

  it('returns 400 when github is missing', async () => {
    getGithubUsernameMock.mockResolvedValue('admin-user')
    isAdminGithubMock.mockReturnValue(true)

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({}))

    expect(response.status).toBe(400)
    expect(triggerSummaryGenerationMock).not.toHaveBeenCalled()
  })

  it('returns 400 when github is empty string', async () => {
    getGithubUsernameMock.mockResolvedValue('admin-user')
    isAdminGithubMock.mockReturnValue(true)

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({ github: '' }))

    expect(response.status).toBe(400)
  })

  it('generates summary for valid admin request', async () => {
    getGithubUsernameMock.mockResolvedValue('admin-user')
    isAdminGithubMock.mockReturnValue(true)
    triggerSummaryGenerationMock.mockResolvedValue({
      throttled: false,
      summary: 'SIGNAL: HIRE\nStrong candidate.'
    })

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({ github: 'candidate' }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({
      throttled: false,
      summary: 'SIGNAL: HIRE\nStrong candidate.'
    })
    expect(triggerSummaryGenerationMock).toHaveBeenCalledWith('candidate')
  })

  it('returns throttled response when generation is throttled', async () => {
    getGithubUsernameMock.mockResolvedValue('admin-user')
    isAdminGithubMock.mockReturnValue(true)
    triggerSummaryGenerationMock.mockResolvedValue({
      throttled: true,
      summary: 'Previous summary.'
    })

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({ github: 'candidate' }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.throttled).toBe(true)
  })

  it('returns 500 when generation throws', async () => {
    getGithubUsernameMock.mockResolvedValue('admin-user')
    isAdminGithubMock.mockReturnValue(true)
    triggerSummaryGenerationMock.mockRejectedValue(new Error('OPENAI_API_KEY is not configured'))

    const { POST } = await import('@/app/api/admin/generate-summary/route')
    const response = await POST(postSummary({ github: 'candidate' }))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('OPENAI_API_KEY is not configured')
  })
})
