import { Suspense } from 'react'
import { getLandingLeaderboard } from '@/features/landing/server/queries'
import { ConvexAuthProvider } from './ConvexAuthProvider'
import { HeroSection, SwitchboardPattern } from './HeroSection'
import { LiveLandingLeaderboard } from './LiveLandingLeaderboard'
import { LandingLeaderboardSkeleton } from './LandingLeaderboard'

function Footer () {
  return (
    <footer className='landing-footer'>
      <span className='landing-footer__text'>A game of connections</span>
      <span className='landing-footer__text'>24 Lines / 1 Operator / Your Shift</span>
    </footer>
  )
}

async function LandingLeaderboardSection () {
  const initialEntries = await getLandingLeaderboard()

  return <LiveLandingLeaderboard initialEntries={initialEntries} />
}

export function LandingPageContent ({
  activeShiftId,
  github
}: {
  activeShiftId: string | null;
  github: string | null;
}) {
  return (
    <ConvexAuthProvider>
      <main className='landing-shell'>
        <SwitchboardPattern />
        <HeroSection github={github} activeShiftId={activeShiftId} />
        <Suspense fallback={<LandingLeaderboardSkeleton />}>
          <LandingLeaderboardSection />
        </Suspense>
        <Footer />
      </main>
    </ConvexAuthProvider>
  )
}
