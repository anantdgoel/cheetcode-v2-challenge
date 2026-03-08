import { NextResponse } from 'next/server'
import { jsonShiftServiceError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { validateDraftForGithub } from '@/features/shift/server'

export const runtime = 'nodejs'

export async function POST (
  request: Request,
  context: { params: Promise<{ shiftId: string }> }
) {
  const authPromise = requireShiftGithub(request, { desktopOnly: true })
  const bodyPromise = request.json() as Promise<{ source?: string }>
  const paramsPromise = context.params
  const auth = await authPromise
  if ('response' in auth) {
    return auth.response
  }
  const { github } = auth

  const [{ source }, { shiftId }] = await Promise.all([bodyPromise, paramsPromise])

  try {
    const result = await validateDraftForGithub({
      github,
      shiftId,
      source: source ?? ''
    })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return jsonShiftServiceError(error, 'Validation failed')
  }
}
