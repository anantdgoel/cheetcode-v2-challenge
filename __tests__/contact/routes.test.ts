import { beforeEach, describe, expect, it, vi } from 'vitest'

const submitContactMock = vi.fn()
const jsonErrorMock = vi.fn((error: string, status: number) =>
  Response.json({ error }, { status })
)

vi.mock('@/features/report/server/queries', () => ({
  submitContact: submitContactMock
}))

vi.mock('@/app/api/shifts/_utils', () => ({
  jsonError: jsonErrorMock
}))

function postContact (body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('submits valid contact info and returns ok', async () => {
    submitContactMock.mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: 'Jane Doe',
        email: 'jane@example.com',
        reportPublicId: 'rpt_abc123'
      })
    )

    expect(submitContactMock).toHaveBeenCalledWith({
      github: 'operator',
      name: 'Jane Doe',
      email: 'jane@example.com',
      reportPublicId: 'rpt_abc123'
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('rejects missing name', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: '',
        email: 'jane@example.com',
        reportPublicId: 'rpt_abc123'
      })
    )

    expect(submitContactMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })

  it('rejects missing email', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: 'Jane',
        email: '',
        reportPublicId: 'rpt_abc123'
      })
    )

    expect(submitContactMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })

  it('rejects email without @', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: 'Jane',
        email: 'not-an-email',
        reportPublicId: 'rpt_abc123'
      })
    )

    expect(submitContactMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })

  it('rejects missing reportPublicId', async () => {
    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: 'Jane',
        email: 'jane@example.com'
      })
    )

    expect(submitContactMock).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
  })

  it('returns 400 when submission fails', async () => {
    submitContactMock.mockRejectedValue(new Error('report not found'))

    const { POST } = await import('@/app/api/contact/route')
    const response = await POST(
      postContact({
        github: 'operator',
        name: 'Jane',
        email: 'jane@example.com',
        reportPublicId: 'rpt_invalid'
      })
    )

    expect(response.status).toBe(400)
  })

  it('trims whitespace from inputs', async () => {
    submitContactMock.mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/contact/route')
    await POST(
      postContact({
        github: '  operator  ',
        name: '  Jane Doe  ',
        email: '  jane@example.com  ',
        reportPublicId: '  rpt_abc123  '
      })
    )

    expect(submitContactMock).toHaveBeenCalledWith({
      github: 'operator',
      name: 'Jane Doe',
      email: 'jane@example.com',
      reportPublicId: 'rpt_abc123'
    })
  })
})
