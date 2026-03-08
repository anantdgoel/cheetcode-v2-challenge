import 'server-only'

import { ConvexHttpClient } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import { api, internal } from '../../../convex/_generated/api'

export function getConvexDeploymentUrl () {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not configured')
  return url
}

export function getConvexAdminKey () {
  const key = process.env.CONVEX_ADMIN_KEY ?? process.env.CONVEX_MUTATION_SECRET
  if (!key) throw new Error('CONVEX_ADMIN_KEY or CONVEX_MUTATION_SECRET is not configured')
  return key
}

export function asShiftId (shiftId: string): Id<'shifts'> {
  return shiftId as Id<'shifts'>
}

type AdminHttpClient = ConvexHttpClient & {
  setAdminAuth(token: string): void;
};

function getAdminClient () {
  const client = new ConvexHttpClient(getConvexDeploymentUrl()) as AdminHttpClient
  client.setAdminAuth(getConvexAdminKey())
  return client
}

function getPublicClient () {
  return new ConvexHttpClient(getConvexDeploymentUrl())
}

export async function fetchPublicQuery<Query extends FunctionReference<'query', 'public'>> (
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return getPublicClient().query(query, args)
}

export async function fetchInternalQuery<Query extends FunctionReference<'query', 'public' | 'internal'>> (
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return getAdminClient().query(
    query as unknown as FunctionReference<'query'>,
    args
  ) as Promise<FunctionReturnType<Query>>
}

export async function fetchInternalMutation<
  Mutation extends FunctionReference<'mutation', 'public' | 'internal'>,
> (
  mutation: Mutation,
  args: FunctionArgs<Mutation>
): Promise<FunctionReturnType<Mutation>> {
  return getAdminClient().mutation(
    mutation as unknown as FunctionReference<'mutation'>,
    args
  ) as Promise<FunctionReturnType<Mutation>>
}

export { api, internal }
