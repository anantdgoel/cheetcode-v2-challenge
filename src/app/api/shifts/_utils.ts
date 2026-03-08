import { NextResponse } from 'next/server'
import { normalizeShiftServiceError } from '@/features/shift/domain/errors'
import { getGithubUsername } from '@/server/auth/github'
import { isDesktopUserAgent } from '@/server/http/user-agent'

const DESKTOP_ONLY_ERROR =
  'Official play is desktop-only. Public reports remain browseable on mobile.'

type RequireShiftGithubOptions = {
  desktopOnly?: boolean;
};

export function jsonError (
  error: string,
  status: number,
  extra?: Record<string, string | number | boolean | undefined>
) {
  return NextResponse.json({ error, ...extra }, { status })
}

export function getErrorMessage (error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function jsonShiftServiceError (error: unknown, fallback: string) {
  const normalizedError = normalizeShiftServiceError(error)
  if (!normalizedError) {
    return jsonError(getErrorMessage(error, fallback), 400)
  }

  if (normalizedError.code === 'active_shift_exists') {
    return jsonError(normalizedError.message, 409, {
      activeShiftId: normalizedError.activeShiftId
    })
  }

  if (normalizedError.code === 'shift_not_found') {
    return jsonError(normalizedError.message, 404)
  }

  return jsonError(normalizedError.message, 400)
}

export async function requireShiftGithub (
  request: Request,
  options: RequireShiftGithubOptions = {}
) {
  const github = await getGithubUsername()
  if (!github) {
    return { response: jsonError('GitHub authentication required', 401) }
  }

  if (options.desktopOnly && !isDesktopUserAgent(request.headers.get('user-agent'))) {
    return { response: jsonError(DESKTOP_ONLY_ERROR, 403) }
  }

  return { github }
}

export { DESKTOP_ONLY_ERROR }
