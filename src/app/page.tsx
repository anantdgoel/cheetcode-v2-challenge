import { LandingPageContent } from '@/components/landing/LandingPageContent'
import { getLandingView } from '@/lib/shifts'
import { getGithubUsername } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Firecrawl Exchange',
  description: 'Real-time AI coding challenge. Start a shift, solve problems, and land on the leaderboard.'
}

export default async function HomePage () {
  const landing = await getLandingView(getGithubUsername())
  return <LandingPageContent landing={landing} />
}
