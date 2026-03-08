import Link from "next/link";
import { HeroSection } from "@/components/HeroSection";
import { ScrollReveal } from "@/components/ScrollReveal";
import { getLandingView } from "@/lib/app/shift-service";
import { formatPercent, formatTitle } from "@/lib/engine/report";
import { getGithubUsername } from "@/lib/server-auth";
import type { LeaderboardEntry } from "@/lib/contracts/views";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Firecrawl Exchange",
  description: "Real-time AI coding challenge. Start a shift, solve problems, and land on the leaderboard.",
};

function formatHold(seconds?: number): string {
  if (seconds == null) return "—";
  return `${seconds.toFixed(1)}s`;
}

function lineNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function fillClass(index: number, title: LeaderboardEntry["title"]): string {
  if (title === "off_the_board") return "line-efficiency__fill--muted";
  if (index === 0) return "line-efficiency__fill--gold";
  return "";
}

function LineTile({ entry, index }: { entry?: LeaderboardEntry; index: number }) {
  if (!entry) {
    return (
      <div className="line-tile line-tile--vacant">
        <div className="line-tile__header">
          <div className="line-tile__indicator">
            <div className="line-dot" />
            <span className="line-number">Line {lineNumber(index)}</span>
          </div>
        </div>
        <p className="line-callsign">No signal</p>
        <div className="line-stats">
          <div className="line-stats__row">
            {["Connected", "Dropped", "Avg Hold"].map((label) => (
              <div key={label} className="line-stat">
                <span className="line-stat__label">{label}</span>
                <span className="line-stat__value">—</span>
              </div>
            ))}
          </div>
          <div className="line-efficiency">
            <div className="line-efficiency__header">
              <span className="line-efficiency__label">Board Efficiency</span>
            </div>
            <div className="line-efficiency__track" />
          </div>
        </div>
      </div>
    );
  }

  const isTop = index === 0;
  const isMuted = entry.title === "off_the_board";

  return (
    <Link
      href={`/report/${entry.publicId}`}
      className={`line-tile${isTop ? " line-tile--top" : ""}`}
    >
      <div className="line-tile__header">
        <div className="line-tile__indicator">
          <div className={`line-dot${isTop ? " line-dot--gold" : ""}`} />
          <span className={`line-number${isTop ? " line-number--gold" : ""}`}>
            Line {lineNumber(index)}
          </span>
        </div>
        <span className="line-classification">{formatTitle(entry.title)}</span>
      </div>

      <p className="line-callsign">{entry.github}</p>

      <div className="line-stats">
        <div className="line-stats__row">
          <div className="line-stat">
            <span className="line-stat__label">Connected</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>
              {entry.connectedCalls != null && entry.totalCalls != null
                ? `${entry.connectedCalls} / ${entry.totalCalls}`
                : "—"}
            </span>
          </div>
          <div className="line-stat">
            <span className="line-stat__label">Dropped</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>
              {entry.droppedCalls ?? "—"}
            </span>
          </div>
          <div className="line-stat">
            <span className="line-stat__label">Avg Hold</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>
              {formatHold(entry.avgHoldSeconds)}
            </span>
          </div>
        </div>

        <div className="line-efficiency">
          <div className="line-efficiency__header">
            <span className="line-efficiency__label">Board Efficiency</span>
            <span className={`line-efficiency__value${isTop ? " line-efficiency__value--gold" : ""}`}>
              {formatPercent(entry.boardEfficiency)}
            </span>
          </div>
          <div className="line-efficiency__track">
            <div
              className={`line-efficiency__fill ${fillClass(index, entry.title)}`}
              style={{ width: `${Math.round(entry.boardEfficiency * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const github = await getGithubUsername();
  const landing = await getLandingView(github);

  const rest = landing.leaderboard.slice(3);

  return (
    <main className="landing-shell">
      <HeroSection github={landing.github} activeShiftId={landing.activeShiftId} />

      {/* Showcase: Shift Reports */}
      <ScrollReveal className="showcase-grid">
        <div className="leaderboard-card">
          <p className="eyebrow">Public Shift Records</p>
          <h2 className="shift-reports-heading">Shift Reports</h2>

          {/* Top 3 tiles — always rendered; empty slots show ghost state */}
          <div className="line-tiles">
            {[0, 1, 2].map((i) => (
              <LineTile key={landing.leaderboard[i]?.publicId ?? `slot-${i}`} entry={landing.leaderboard[i]} index={i} />
            ))}
          </div>

          {/* Board Dispatch Log */}
          {rest.length > 0 && (
            <div className="dispatch-log">
              <span className="dispatch-log__label">— Board Dispatch Log</span>

              <div className="dispatch-log__head">
                <span className="dispatch-log__col--line">Line</span>
                <span className="dispatch-log__col--callsign">Callsign</span>
                <span className="dispatch-log__col--class">Classification</span>
                <span className="dispatch-log__col--connected">Connected</span>
                <span className="dispatch-log__col--efficiency">Efficiency</span>
              </div>

              {rest.map((entry, i) => {
                const globalIndex = i + 3;
                const isOff = entry.title === "off_the_board";
                const pct = Math.round(entry.boardEfficiency * 100);

                return (
                  <Link
                    key={entry.publicId}
                    href={`/report/${entry.publicId}`}
                    className={`dispatch-log__row${isOff ? " dispatch-log__row--muted" : ""}`}
                  >
                    <span className="dispatch-log__col--line">
                      {lineNumber(globalIndex)}
                    </span>
                    <span className="dispatch-log__col--callsign">
                      {entry.github}
                    </span>
                    <span className="dispatch-log__col--class">
                      {formatTitle(entry.title)}
                    </span>
                    <span className="dispatch-log__col--connected">
                      {entry.connectedCalls != null && entry.totalCalls != null
                        ? `${entry.connectedCalls} / ${entry.totalCalls}`
                        : "—"}
                    </span>
                    <div className="dispatch-log__col--efficiency">
                      <div className="dispatch-log__bar-track">
                        <div
                          className="dispatch-log__bar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isOff ? "rgba(26,20,16,0.12)" : "var(--accent)",
                          }}
                        />
                      </div>
                      <span className="dispatch-log__pct">
                        {formatPercent(entry.boardEfficiency)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </ScrollReveal>

      {/* Rules: mechanic first, then context, then scoring */}
      <section className="rules-grid">
        <ScrollReveal delay={0}>
          <article className="rule-card">
            <p className="eyebrow">Operator Contract</p>
            <h2>Submit one stateful `connect(input)` function</h2>
            <p>
              Your policy decides whether to connect immediately or consign the call to hold. Runtime state
              persists within a run. Board load is visible. Premium trunks are scarce, visible, and costly to waste.
            </p>
          </article>
        </ScrollReveal>
        <ScrollReveal delay={0.08}>
          <article className="rule-card">
            <p className="eyebrow">How It Works</p>
            <h2>Receive a seeded evidence bundle</h2>
            <p>
              Every shift yields the same four artifacts: the board manual, a weak but valid starter,
              visible line metadata, and a large historical observations log built to reward inference over manual play.
            </p>
          </article>
        </ScrollReveal>
        <ScrollReveal delay={0.16}>
          <article className="rule-card">
            <p className="eyebrow">Public Record</p>
            <h2>Best live result only</h2>
            <p>
              Leaderboard rank follows the hidden board score. Public display shows title and board efficiency,
              while completed Shift Reports remain shareable by URL.
            </p>
          </article>
        </ScrollReveal>
      </section>
    </main>
  );
}
