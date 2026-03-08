// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactForm } from '@/features/report/client/ContactForm'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ContactForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders the form with heading and inputs when not already submitted', () => {
    render(
      <ContactForm github='operator' reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    expect(screen.getByText(/you've got our attention/i)).toBeTruthy()
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /submit/i })).toBeTruthy()
  })

  it('shows thanks message when alreadySubmitted is true', () => {
    render(
      <ContactForm github='operator' reportPublicId='rpt_123' alreadySubmitted />
    )

    expect(screen.getByText(/we'll be in touch/i)).toBeTruthy()
    expect(screen.queryByLabelText(/name/i)).toBeNull()
  })

  it('submits form data and shows thanks on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ContactForm github='operator' reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch/i)).toBeTruthy()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github: 'operator',
        name: 'Jane Doe',
        email: 'jane@example.com',
        reportPublicId: 'rpt_123'
      })
    })
  })

  it('shows error message when submission fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'report not found' })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ContactForm github='operator' reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByText('report not found')).toBeTruthy()
    })

    expect(screen.queryByText(/we'll be in touch/i)).toBeNull()
  })

  it('disables button while submitting', async () => {
    let resolveSubmit: (() => void) | undefined
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<{ ok: boolean; json: () => Promise<{ ok: boolean }> }>((resolve) => {
        resolveSubmit = () => resolve({ ok: true, json: async () => ({ ok: true }) })
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ContactForm github='operator' reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeTruthy()
    })
    expect(screen.getByRole('button')).toBeInstanceOf(HTMLButtonElement)

    resolveSubmit!()

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch/i)).toBeTruthy()
    })
  })
})
