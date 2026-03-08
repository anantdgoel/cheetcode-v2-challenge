'use client'

import { signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type StartShiftResponse = {
  activeShiftId?: string;
  error?: string;
  shift?: {
    id: string;
  } | null;
};

async function readJson<T> (response: Response): Promise<T> {
  return response.json() as Promise<T>
}

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

  function startShift () {
    setError('')

    startTransition(async () => {
      try {
        const response = await fetch('/api/shifts/start', {
          headers: { 'content-type': 'application/json' },
          method: 'POST'
        })
        const data = await readJson<StartShiftResponse>(response)

        if (response.status === 409 && data.activeShiftId) {
          router.push(`/shift/${data.activeShiftId}`)
          return
        }
        if (!response.ok || !data.shift) {
          throw new Error(data.error ?? 'Shift launch failed')
        }
        router.push(`/shift/${data.shift.id}`)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Shift launch failed')
      }
    })
  }

  if (!github) {
    return (
      <button type="button" className="app-button" onClick={() => signIn('github')}>
        Sign in with GitHub
      </button>
    )
  }

  return (
    <div className="session-controls">
      <div className="session-controls__actions">
        {activeShiftId
          ? (
          <button
            type="button"
            className="app-button"
            onClick={() => router.push(`/shift/${activeShiftId}`)}
          >
            Resume Shift
          </button>
            )
          : (
          <button
            type="button"
            className="app-button"
            disabled={isPending}
            onClick={startShift}
          >
            {isPending ? 'Opening Exchange...' : 'Start Shift'}
          </button>
            )}
        <button
          type="button"
          className="app-button app-button--secondary"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign Out
        </button>
      </div>
      <span className="session-controls__identity">
        Signed in as <strong>{github}</strong>
      </span>
      {error ? <p className="session-controls__error">{error}</p> : null}
    </div>
  )
}
