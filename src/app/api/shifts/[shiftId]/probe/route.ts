import { NextResponse } from 'next/server'
import { jsonShiftServiceError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { runProbeForGithub } from '@/features/shift/server'

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
    const result = await runProbeForGithub({ github, shiftId })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return jsonShiftServiceError(error, 'Probe failed')
  }
}
