'use client'

import { signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useStartShift } from '@/features/shift/client/convex-api'
import { extractErrorMessage } from '@/lib/convex-error'

export default function SessionControls ({
  activeShiftId,
  github
}: {
  activeShiftId: string | null | undefined;
  github: string | null | undefined;
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const startShift = useStartShift()

  function handleStartShift () {
    setError('')

    startTransition(async () => {
      try {
        const result = await startShift() as
          | { activeShiftId: string; kind: 'active_shift_exists' }
          | { kind: 'started'; shift: { id: string } }
        if (result.kind === 'active_shift_exists') {
          router.push(`/shift/${result.activeShiftId}`)
          return
        }
        if (result.shift) {
          router.push(`/shift/${result.shift.id}`)
        }
      } catch (caught) {
        setError(extractErrorMessage(caught, 'Shift launch failed'))
      }
    })
  }

  if (!github) {
    return (
      <button type='button' className='app-button' onClick={() => signIn('github')}>
        Sign in with GitHub
      </button>
    )
  }

  return (
    <div className='session-controls'>
      <div className='session-controls__actions'>
        {activeShiftId
          ? (
            <button
              type='button'
              className='app-button'
              onClick={() => { router.push(`/shift/${activeShiftId}`) }}
            >
              Resume Shift
            </button>
            )
          : (
            <button
              type='button'
              className='app-button'
              disabled={isPending}
              onClick={handleStartShift}
            >
              {isPending ? 'Opening Exchange...' : 'Start Shift'}
            </button>
            )}
        <button
          type='button'
          className='app-button app-button--secondary'
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign Out
        </button>
      </div>
      <span className='session-controls__identity'>
        Signed in as <strong>{github}</strong>
      </span>
      {error ? <p className='session-controls__error'>{error}</p> : null}
    </div>
  )
}
