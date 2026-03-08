import { NextResponse } from 'next/server'
import { getCurrentShiftForGithub } from '@/features/shift/server'
import { getGithubUsername } from '@/server/auth/github'

export const runtime = 'nodejs'

export async function GET () {
  const shift = await getGithubUsername().then((github) =>
    github ? getCurrentShiftForGithub(github) : null
  )
  return NextResponse.json({ shift })
}
