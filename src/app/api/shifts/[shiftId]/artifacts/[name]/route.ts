import { NextResponse } from 'next/server'
import { getErrorMessage, jsonError, requireShiftGithub } from '@/app/api/shifts/_utils'
import { getArtifactForShift } from '@/features/shift/server'

export const runtime = 'nodejs'

export async function GET (
  _request: Request,
  context: { params: Promise<{ shiftId: string; name: string }> }
) {
  const authPromise = requireShiftGithub(_request, { desktopOnly: true })
  const paramsPromise = context.params
  const auth = await authPromise
  if ('response' in auth) {
    return auth.response
  }
  const { github } = auth

  const { shiftId, name } = await paramsPromise
  try {
    const artifact = await getArtifactForShift(github, shiftId, name)
    if (!artifact) {
      return jsonError('Artifact unavailable', 404)
    }

    return new NextResponse(artifact.content, {
      headers: {
        'content-type': artifact.type,
        'cache-control': 'no-store'
      }
    })
  } catch (error) {
    return jsonError(getErrorMessage(error, 'Artifact unavailable'), 400)
  }
}
