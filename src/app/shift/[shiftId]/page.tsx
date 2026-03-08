import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ShiftConsole from '@/features/shift/ShiftConsole'
import { getOwnedShiftForGithub } from '@/lib/shifts'
import { getGithubUsername } from '@/lib/server-auth'
import { isDesktopUserAgent } from '@/lib/validation'

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
