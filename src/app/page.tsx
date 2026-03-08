import { LandingPageContent } from '@/features/landing/client/LandingPageContent'
import { getCurrentShiftForGithub } from '@/features/shift/server'
import { getGithubUsername } from '@/server/auth/github'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Firecrawl Exchange',
  description: 'Real-time AI coding challenge. Start a shift, solve problems, and land on the leaderboard.'
}

export default async function HomePage () {
  const githubPromise = getGithubUsername()
  const [github, activeShift] = await Promise.all([
    githubPromise,
    githubPromise.then(async (currentGithub) => {
      if (!currentGithub) return null
      return getCurrentShiftForGithub(currentGithub)
    })
  ])

  return (
    <LandingPageContent
      activeShiftId={activeShift?.id ?? null}
      github={github}
    />
  )
}
