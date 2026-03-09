'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { isDesktopUserAgent } from '@/core/http/user-agent'
import { shapeShiftView } from '../domain/view'
import { useShiftRecord } from './convex-api'
import ShiftConsole from './ShiftConsole'

type SessionUser = {
  convexToken?: string;
  githubUsername?: string;
}

function ShiftPageShell ({ message }: { message: string }) {
  return (
    <main className='report-shell'>
      <p>{message}</p>
    </main>
  )
}

export function ShiftPageClient ({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const user = session?.user as SessionUser | undefined
  const liveRecord = useShiftRecord(shiftId)
  const isSessionLoading = status === 'loading'
  const hasAuthenticatedSession = status === 'authenticated' && !!session
  const hasConvexSession = hasAuthenticatedSession && !!user?.githubUsername && !!user.convexToken

  useEffect(() => {
    setIsDesktop(isDesktopUserAgent(window.navigator.userAgent))
  }, [])

  useEffect(() => {
    if (
      isDesktop === false ||
      status === 'unauthenticated' ||
      (hasAuthenticatedSession && !hasConvexSession) ||
      (hasConvexSession && liveRecord === null)
    ) {
      router.replace('/')
    }
  }, [hasAuthenticatedSession, hasConvexSession, isDesktop, liveRecord, router, status])

  /* eslint-disable react-hooks/purity -- Date.now() is the conversion timestamp for shapeShiftView; intentionally impure */
  const shift = useMemo(() => {
    return liveRecord ? shapeShiftView(liveRecord, Date.now()) : null
  }, [liveRecord])
  /* eslint-enable react-hooks/purity */

  if (isDesktop == null || isSessionLoading) {
    return <ShiftPageShell message='Patching you through…' />
  }

  if (
    isDesktop === false ||
    status === 'unauthenticated' ||
    (hasAuthenticatedSession && !hasConvexSession)
  ) {
    return <ShiftPageShell message='Returning to the board…' />
  }

  if (!hasConvexSession || !shift) {
    return <ShiftPageShell message='Connecting to Central Office…' />
  }

  return <ShiftConsole shift={shift} />
}
