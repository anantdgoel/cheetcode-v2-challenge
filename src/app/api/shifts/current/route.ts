import { NextResponse } from 'next/server'
import { getCurrentShiftForGithub } from '@/lib/shifts'
import { getGithubUsername } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function GET () {
  const shift = await getGithubUsername().then((github) =>
    github ? getCurrentShiftForGithub(github) : null
  )
  return NextResponse.json({ shift })
}
