import { NextResponse } from 'next/server'
import { getErrorMessage, jsonError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { goLiveForGithub } from '@/lib/shifts'

export const runtime = 'nodejs'

export async function POST (
  _request: Request,
  context: { params: Promise<{ shiftId: string }> }
) {
  const authPromise = requireShiftGithub(_request, { desktopOnly: true })
  const paramsPromise = context.params
  const auth = await authPromise
  if ('response' in auth) {
    return auth.response
  }
  const { github } = auth

  const { shiftId } = await paramsPromise

  try {
    const result = await goLiveForGithub({ github, shiftId })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return jsonError(getErrorMessage(error, 'Go Live failed'), 400)
  }
}
