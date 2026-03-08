import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ShiftConsole from '@/features/shift/client/ShiftConsole'
import { getOwnedShiftForGithub } from '@/features/shift/server'
import { getGithubUsername } from '@/server/auth/github'
import { isDesktopUserAgent } from '@/server/http/user-agent'

export const dynamic = 'force-dynamic'

export default async function ShiftPage ({
  params
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const [github, requestHeaders, { shiftId }] = await Promise.all([
    getGithubUsername(),
    headers(),
    params
  ])
  if (!github) {
    redirect('/')
  }
  if (!isDesktopUserAgent(requestHeaders.get('user-agent'))) {
    redirect('/')
  }

  const shift = await getOwnedShiftForGithub(github, shiftId)
  if (!shift) {
    redirect('/')
  }

  return <ShiftConsole initialShift={shift} />
}
