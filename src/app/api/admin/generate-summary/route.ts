import { NextResponse } from 'next/server'
import { getGithubUsername, isAdminGithub } from '@/server/auth/github'
import { triggerSummaryGeneration } from '@/features/admin/server/queries'

export async function POST (request: Request) {
  const github = await getGithubUsername()
  if (!isAdminGithub(github)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json() as { github?: string }
  const candidateGithub = body.github
  if (!candidateGithub || typeof candidateGithub !== 'string') {
    return NextResponse.json({ error: 'github is required' }, { status: 400 })
  }

  try {
    const result = await triggerSummaryGeneration(candidateGithub)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
