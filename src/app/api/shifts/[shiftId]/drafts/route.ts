import { NextResponse } from 'next/server'
import { getErrorMessage, jsonError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { saveDraftForGithub } from '@/lib/shifts'

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
    const shift = await saveDraftForGithub({
      github,
      shiftId,
      source: source ?? ''
    })
    return NextResponse.json({ ok: true, savedAt: shift?.latestDraftSavedAt ?? Date.now() })
  } catch (error) {
    return jsonError(getErrorMessage(error, 'Draft save failed'), 400)
  }
}
