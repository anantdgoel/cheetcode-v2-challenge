"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { formatPercent, formatTitle } from "@/lib/engine/report";
import type { LeaderboardEntry } from "@/lib/contracts/views";

const PAGE_SIZE = 5;

/* ─── Animation helpers ─── */

const FADE_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const FADE_VARIANTS = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };
const VIEWPORT = { once: true, margin: "-60px" as const };

function FadeIn({ children, delay = 0, className, style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={FADE_VARIANTS}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ ...FADE_SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}


/* ─── Data formatting ─── */

function formatHold(seconds?: number) {
  return seconds == null ? "—" : `${seconds.toFixed(1)}s`;
}

function lineNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function connectedDisplay(e: LeaderboardEntry) {
  return e.connectedCalls != null && e.totalCalls != null ? `${e.connectedCalls} / ${e.totalCalls}` : "—";
}

function efficiencyFillClass(index: number, title: LeaderboardEntry["title"]) {
  if (title === "off_the_board") return "line-efficiency__fill--muted";
  if (index === 0) return "line-efficiency__fill--gold";
  return "";
}

/* ─── Sub-components ─── */

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
            {(["Connected", "Dropped", "Avg Hold"] as const).map((label) => (
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
    <Link href={`/report/${entry.publicId}`} className={`line-tile${isTop ? " line-tile--top" : ""}`}>
      <div className="line-tile__header">
        <div className="line-tile__indicator">
          <div className={`line-dot${isTop ? " line-dot--gold" : ""}`} />
          <span className={`line-number${isTop ? " line-number--gold" : ""}`}>Line {lineNumber(index)}</span>
        </div>
        <span className="line-classification">{formatTitle(entry.title)}</span>
      </div>
      <p className="line-callsign">{entry.github}</p>
      <div className="line-stats">
        <div className="line-stats__row">
          <div className="line-stat">
            <span className="line-stat__label">Connected</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>{connectedDisplay(entry)}</span>
          </div>
          <div className="line-stat">
            <span className="line-stat__label">Dropped</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>{entry.droppedCalls ?? "—"}</span>
          </div>
          <div className="line-stat">
            <span className="line-stat__label">Avg Hold</span>
            <span className={`line-stat__value${isMuted ? " line-stat__value--muted" : ""}`}>{formatHold(entry.avgHoldSeconds)}</span>
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
              className={`line-efficiency__fill ${efficiencyFillClass(index, entry.title)}`}
              style={{ width: `${Math.round(entry.boardEfficiency * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M7.5 2.5L4 6l3.5 3.5" : "M4.5 2.5L8 6l-3.5 3.5";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/* ─── Main component ─── */

export function LandingLeaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const [page, setPage] = useState(0);
  const rest = leaderboard.slice(3);
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const pageEntries = rest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showStart = page * PAGE_SIZE + 4;
  const showEnd = Math.min((page + 1) * PAGE_SIZE + 3, rest.length + 3);
  return (
    <div className="leaderboard-card">

      <FadeIn className="leaderboard-card__header">
        <p className="eyebrow">Public Shift Records</p>
        <h2 className="shift-reports-heading">Shift Reports</h2>
      </FadeIn>

      <div className="line-tiles">
        {[0, 1, 2].map((i) => (
          <FadeIn key={leaderboard[i]?.publicId ?? `slot-${i}`} delay={0.1 + i * 0.1} style={{ flex: 1, minWidth: 0 }}>
            <LineTile entry={leaderboard[i]} index={i} />
          </FadeIn>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="dispatch-log">
          <FadeIn delay={0.4}>
            <span className="dispatch-log__label">— Board Dispatch Log</span>
          </FadeIn>

          <FadeIn delay={0.5} className="dispatch-log__head">
            <span className="dispatch-log__col--line">Line</span>
            <span className="dispatch-log__col--callsign">Callsign</span>
            <span className="dispatch-log__col--class">Classification</span>
            <span className="dispatch-log__col--spacer" />
            <span className="dispatch-log__col--connected">Connected</span>
            <span className="dispatch-log__col--efficiency">Efficiency</span>
          </FadeIn>

          {pageEntries.map((entry, i) => {
            const globalIndex = page * PAGE_SIZE + i + 3;
            const isOff = entry.title === "off_the_board";
            const pct = Math.round(entry.boardEfficiency * 100);

            return (
              <FadeIn key={entry.publicId} delay={0.55 + i * 0.07}>
                <Link
                  href={`/report/${entry.publicId}`}
                  className={`dispatch-log__row${isOff ? " dispatch-log__row--muted" : ""}`}
                >
                  <span className="dispatch-log__col--line">{lineNumber(globalIndex)}</span>
                  <span className="dispatch-log__col--callsign">{entry.github}</span>
                  <span className="dispatch-log__col--class">{formatTitle(entry.title)}</span>
                  <span className="dispatch-log__col--spacer" />
                  <span className="dispatch-log__col--connected">{connectedDisplay(entry)}</span>
                  <div className="dispatch-log__col--efficiency">
                    <div className="dispatch-log__bar-track">
                      <div
                        className="dispatch-log__bar-fill"
                        style={{ backgroundColor: isOff ? "rgba(26,20,16,0.12)" : "var(--accent-bar)", width: `${pct}%` }}
                      />
                    </div>
                    <span className="dispatch-log__pct">{formatPercent(entry.boardEfficiency)}</span>
                  </div>
                </Link>
              </FadeIn>
            );
          })}

          {totalPages > 1 && (
            <div className="dispatch-log__pagination">
              <span className="dispatch-log__pagination-info">
                Showing {showStart}–{showEnd} of {leaderboard.length}
              </span>
              <div className="dispatch-log__pagination-controls">
                <button type="button" className="dispatch-log__pagination-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <Chevron direction="left" />
                </button>
                <span className="dispatch-log__pagination-label">Page {page + 1} of {totalPages}</span>
                <button type="button" className="dispatch-log__pagination-btn" disabled={page === totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <Chevron direction="right" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
