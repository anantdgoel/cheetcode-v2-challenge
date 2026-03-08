import type { LandingView } from "@/lib/domain/views";
import { HeroSection, SwitchboardPattern } from "./HeroSection";
import { LandingLeaderboard } from "./LandingLeaderboard";

function Footer() {
  return (
    <footer className="landing-footer">
      <span className="landing-footer__text">A game of connections</span>
      <span className="landing-footer__text">24 Lines / 1 Operator / Your Shift</span>
    </footer>
  );
}

export function LandingPageContent({ landing }: { landing: LandingView }) {
  return (
    <main className="landing-shell">
      <SwitchboardPattern />
      <HeroSection github={landing.github} activeShiftId={landing.activeShiftId} />
      <LandingLeaderboard leaderboard={landing.leaderboard} />
      <Footer />
    </main>
  );
}
