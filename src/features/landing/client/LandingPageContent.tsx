import { Suspense } from 'react'
import { getLandingLeaderboard } from '@/features/landing/server/queries'
import { ConvexPublicProvider } from './ConvexPublicProvider'
import { HeroSection, SwitchboardPattern } from './HeroSection'
import { LiveLandingLeaderboard } from './LiveLandingLeaderboard'

function Footer () {
  return (
    <footer className="landing-footer">
      <span className="landing-footer__text">A game of connections</span>
      <span className="landing-footer__text">24 Lines / 1 Operator / Your Shift</span>
    </footer>
  )
}

function LandingLeaderboardFallback () {
  return (
    <section className="leaderboard-card" aria-busy="true">
      <div className="leaderboard-card__header">
        <p className="eyebrow">Public Shift Records</p>
        <h2 className="shift-reports-heading">Shift Reports</h2>
      </div>
      <p className="console-supervisor__empty">Loading leaderboard...</p>
    </section>
  )
}

async function LandingLeaderboardSection () {
  const initialLeaderboard = await getLandingLeaderboard()

  return (
    <ConvexPublicProvider>
      <LiveLandingLeaderboard initialLeaderboard={initialLeaderboard} />
    </ConvexPublicProvider>
  )
}

export function LandingPageContent ({
  activeShiftId,
  github
}: {
  activeShiftId: string | null;
  github: string | null;
}) {
  return (
    <main className="landing-shell">
      <SwitchboardPattern />
      <HeroSection github={github} activeShiftId={activeShiftId} />
      <Suspense fallback={<LandingLeaderboardFallback />}>
        <LandingLeaderboardSection />
      </Suspense>
      <Footer />
    </main>
  )
}
