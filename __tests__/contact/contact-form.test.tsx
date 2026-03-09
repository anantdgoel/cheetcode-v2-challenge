// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContactForm } from '@/features/report/client/ContactForm'

const submitContactMock = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: () => submitContactMock
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  submitContactMock.mockReset()
})

describe('ContactForm', () => {
  it('renders the form with heading and inputs when not already submitted', () => {
    render(
      <ContactForm reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    expect(screen.getByText(/you've got our attention/i)).toBeTruthy()
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /submit/i })).toBeTruthy()
  })

  it('shows thanks message when alreadySubmitted is true', () => {
    render(
      <ContactForm reportPublicId='rpt_123' alreadySubmitted />
    )

    expect(screen.getByText(/we'll be in touch/i)).toBeTruthy()
    expect(screen.queryByLabelText(/name/i)).toBeNull()
  })

  it('submits form data and shows thanks on success', async () => {
    submitContactMock.mockResolvedValue(undefined)

    render(
      <ContactForm reportPublicId='rpt_123' alreadySubmitted={false} />
    )

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => {
      expect(screen.getByText(/we'll be in touch/i)).toBeTruthy()
    })

    expect(submitContactMock).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      reportPublicId: 'rpt_123'
    })
  })

  it('shows error message when submission fails', async () => {
    submitContactMock.mockRejectedValue(new Error('report not found'))

    render(
      <ContactForm reportPublicId='rpt_123' alreadySubmitted={false} />
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
    submitContactMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
    )

    render(
      <ContactForm reportPublicId='rpt_123' alreadySubmitted={false} />
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
