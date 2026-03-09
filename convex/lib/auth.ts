import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'

type AuthCtx = QueryCtx | MutationCtx | ActionCtx

export async function getAuthenticatedGithub (ctx: AuthCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  // The JWT `sub` claim is the GitHub username, set in auth.ts signConvexToken()
  return identity.subject ?? null
}

export async function requireAuthenticatedGithub (ctx: AuthCtx): Promise<string> {
  const github = await getAuthenticatedGithub(ctx)
  if (!github) {
    throw new Error('Authentication required')
  }
  return github
}

/** Reads ADMIN_GITHUB_LOGINS from Convex environment variables. */
export function isAdminGithub (github: string): boolean {
  const raw = process.env.ADMIN_GITHUB_LOGINS ?? ''
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(github)
}
