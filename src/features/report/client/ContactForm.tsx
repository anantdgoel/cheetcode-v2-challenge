'use client'

import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { extractErrorMessage } from '@/lib/convex-error'

const submitContactMutation = api.contactSubmissions.submitContact

export function ContactForm ({
  reportPublicId,
  alreadySubmitted
}: {
  reportPublicId: string;
  alreadySubmitted: boolean;
}) {
  const [submitted, setSubmitted] = useState(alreadySubmitted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitContact = useMutation(submitContactMutation)

  async function handleSubmit (event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = event.currentTarget
    const formData = new FormData(form)
    const name = (formData.get('name') as string).trim()
    const email = (formData.get('email') as string).trim()

    if (!name || !email) {
      setError('Please fill in both fields.')
      setSubmitting(false)
      return
    }

    try {
      await submitContact({ name, email, reportPublicId })
      setSubmitted(true)
    } catch (err) {
      setError(extractErrorMessage(err, 'Something went wrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className='report-contact'>
      <div className='report-contact__letterhead'>
        <span>Form CI-12</span>
        <span>Contact Information</span>
      </div>

      {submitted
        ? (
          <div className='report-contact__body'>
            <p className='report-contact__thanks'>Thanks &mdash; we&apos;ll be in touch.</p>
          </div>
          )
        : (
          <div className='report-contact__body'>
            <h2 className='report-contact__heading'>
              You&apos;ve got our attention, we&apos;d love to chat
            </h2>
            <p className='report-contact__subtext'>Leave your details and we&apos;ll reach out.</p>

            <form className='report-contact__form' onSubmit={handleSubmit}>
              <div className='report-contact__inputs'>
                <div className='report-contact__field'>
                  <label className='report-contact__label' htmlFor='contact-name'>Name</label>
                  <input
                    id='contact-name'
                    className='report-contact__input'
                    name='name'
                    type='text'
                    placeholder='Your name'
                    required
                  />
                </div>
                <div className='report-contact__field'>
                  <label className='report-contact__label' htmlFor='contact-email'>Email</label>
                  <input
                    id='contact-email'
                    className='report-contact__input'
                    name='email'
                    type='email'
                    placeholder='you@example.com'
                    required
                  />
                </div>
              </div>

              {error && <p className='report-contact__error'>{error}</p>}

              <button className='app-button' type='submit' disabled={submitting}>
                {submitting ? 'Submitting\u2026' : 'Submit'}
              </button>
            </form>
          </div>
          )}
    </section>
  )
}
