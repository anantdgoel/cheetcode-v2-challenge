import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { ArtifactName } from '../src/core/domain/game'
import { getAuthenticatedGithub } from './lib/auth'

const SHIFT_ARTIFACTS = [
  'manual.md',
  'starter.js',
  'lines.json',
  'observations.jsonl'
] as const satisfies readonly ArtifactName[]

const SHIFT_ARTIFACT_TYPES: Record<ArtifactName, string> = {
  'manual.md': 'text/markdown',
  'starter.js': 'text/javascript',
  'lines.json': 'application/json',
  'observations.jsonl': 'application/x-ndjson'
}

const http = httpRouter()

http.route({
  path: '/api/artifacts',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const github = await getAuthenticatedGithub(ctx)
    if (!github) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = new URL(request.url)
    const shiftId = url.searchParams.get('shiftId')
    const name = url.searchParams.get('name')

    if (!shiftId || !name) {
      return new Response('Missing shiftId or name', { status: 400 })
    }

    const artifactName = name as ArtifactName
    if (!(SHIFT_ARTIFACTS as readonly string[]).includes(artifactName)) {
      return new Response('Invalid artifact name', { status: 400 })
    }

    // Verify ownership and get shift data
    const shift = await ctx.runQuery(internal.sessions.getOwnedShift, {
      github,
      shiftId: shiftId as Id<'shifts'>
    })
    if (!shift || shift.state !== 'active') {
      return new Response('Shift not found or inactive', { status: 404 })
    }

    // Record artifact fetch
    await ctx.runMutation(internal.sessions.recordArtifactFetch, {
      github,
      shiftId: shiftId as Id<'shifts'>,
      name: artifactName,
      at: Date.now()
    })

    // Generate artifact content
    const { buildArtifactContent } = await import('../src/core/engine/artifacts')
    const content = buildArtifactContent(artifactName, shift.seed)

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': SHIFT_ARTIFACT_TYPES[artifactName],
        'Cache-Control': 'no-store'
      }
    })
  })
})

export default http
