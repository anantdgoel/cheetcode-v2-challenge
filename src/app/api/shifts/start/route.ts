import { NextResponse } from 'next/server'
import { jsonShiftServiceError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { startShiftForGithub } from '@/features/shift/server'

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
    return jsonShiftServiceError(error, 'Failed to start shift')
  }
}
