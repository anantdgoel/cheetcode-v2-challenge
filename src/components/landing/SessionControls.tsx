'use client'

import { signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { readJson } from '@/lib/frontend/http'

type StartShiftResponse = {
  activeShiftId?: string;
  error?: string;
  shift?: {
    id: string;
  } | null;
};

export default function SessionControls ({
  activeShiftId,
  github
}: {
  activeShiftId: string | null | undefined;
  github: string | null | undefined;
}) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function startShift () {
    setStarting(true)
    setError('')

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
    } finally {
      setStarting(false)
    }
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
            disabled={starting}
            onClick={startShift}
          >
            {starting ? 'Opening Exchange...' : 'Start Shift'}
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
