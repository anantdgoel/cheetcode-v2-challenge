import { ConvexHttpClient } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { api, internal } from '../../../convex/_generated/api'

type ShiftId = FunctionArgs<typeof internal.sessions.getOwnedShift>['shiftId']

type AdminAuthClient = ConvexHttpClient & {
  setAdminAuth(token: string): void;
}

type FunctionKind = 'action' | 'mutation' | 'query'

function getConvexDeploymentUrl () {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured')
  return url
}

function getConvexAdminKey () {
  const key = process.env.CONVEX_ADMIN_KEY
  if (!key) throw new Error('CONVEX_ADMIN_KEY is not configured')
  return key
}

export function asShiftId (shiftId: string): ShiftId {
  const normalizedShiftId = shiftId.trim()
  if (!normalizedShiftId) {
    throw new Error('shift id is required')
  }
  if (normalizedShiftId !== shiftId) {
    throw new Error('shift id must not include surrounding whitespace')
  }

  return normalizedShiftId as ShiftId
}

function getAdminClient () {
  const client = new ConvexHttpClient(getConvexDeploymentUrl()) as AdminAuthClient
  client.setAdminAuth(getConvexAdminKey())
  return client
}

function getPublicClient () {
  return new ConvexHttpClient(getConvexDeploymentUrl())
}

function coerceFunctionReference<Kind extends FunctionKind> (
  reference: FunctionReference<Kind, 'public' | 'internal'>
): FunctionReference<Kind> {
  return reference as unknown as FunctionReference<Kind>
}

export async function fetchPublicQuery<Query extends FunctionReference<'query'>> (
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return getPublicClient().query(query, args)
}

export async function fetchInternalQuery<Query extends FunctionReference<'query', 'public' | 'internal'>> (
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return getAdminClient().query(coerceFunctionReference(query), args) as Promise<FunctionReturnType<Query>>
}

export async function fetchInternalAction<
  Action extends FunctionReference<'action', 'public' | 'internal'>
> (
  action: Action,
  args: FunctionArgs<Action>
): Promise<FunctionReturnType<Action>> {
  return getAdminClient().action(coerceFunctionReference(action), args) as Promise<FunctionReturnType<Action>>
}

export { api, internal }
