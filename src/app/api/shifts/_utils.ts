import { NextResponse } from 'next/server'
import { getGithubUsername } from '@/lib/server-auth'
import { isDesktopUserAgent } from '@/lib/validation'

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
