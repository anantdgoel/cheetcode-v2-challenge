import { NextResponse } from 'next/server'
import { getErrorMessage, jsonError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { startShiftForGithub } from '@/lib/shifts'

export const runtime = 'nodejs'

export async function POST (request: Request) {
  const auth = await requireShiftGithub(request, { desktopOnly: true })
  if ('response' in auth) {
    return auth.response
  }
  const { github } = auth

  try {
    const shift = await startShiftForGithub(github)
    return NextResponse.json({ shift })
  } catch (error) {
    const message = getErrorMessage(error, 'Failed to start shift')
    const status = message.startsWith('active shift:') ? 409 : 400
    const activeShiftId = message.startsWith('active shift:') ? message.split(':')[1] : undefined
    return jsonError(message, status, { activeShiftId })
  }
}
