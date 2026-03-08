/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — HeroSection
 *
 * ENTRANCE (time-driven, ms after mount):
 *    0ms   all hero content invisible
 *  120ms   eyebrow slides up 10px → fades in
 *  320ms   headline scales 0.94 → 1.0, fades in
 *  620ms   lede slides up 8px → fades in
 *  850ms   SessionControls pops in (scale 0.97 → 1.0)
 * 1050ms   facts pills stagger in (80ms × 3 pills, left to right)
 * 1300ms   hero note fades in
 *
 * INTERACTION (cursor-driven, continuous):
 *   mouse move → desk lamp radial glow follows cursor (spring 160/22)
 *   mouse leave → lamp fades out (0.4s ease)
 * ───────────────────────────────────────────────────────── */

"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import SessionControls from "./SessionControls";

// ── Entrance timing ──────────────────────────────────────
const TIMING = {
  eyebrow:  120,   // eyebrow label slides up
  headline: 320,   // headline scales in
  lede:     620,   // lede paragraph fades up
  cta:      850,   // SessionControls pops in
  facts:    1050,  // fact pills start staggering
  note:     1300,  // mobile note fades in
};

// ── Entrance spring configs ──────────────────────────────
const EYEBROW  = { offsetY: 10, spring: { type: "spring" as const, stiffness: 350, damping: 28 } };
const HEADLINE = { initialScale: 0.94, spring: { type: "spring" as const, stiffness: 300, damping: 30 } };
const LEDE     = { offsetY: 8,  spring: { type: "spring" as const, stiffness: 350, damping: 28 } };
const CTA      = { initialScale: 0.97, spring: { type: "spring" as const, stiffness: 500, damping: 25 } };
const FACTS    = {
  stagger: 0.08,
  offsetY: 6,
  spring: { type: "spring" as const, stiffness: 400, damping: 26 },
  items: [
    "5 minutes investigation",
    "1 Supervisor Trial",
    "2 minute final board call",
  ],
};

// ── Interaction spring config ────────────────────────────
// Desk lamp — chases cursor like a real spotlight
const LAMP_SPRING = { stiffness: 160, damping: 22 };

// ── Component ────────────────────────────────────────────
interface HeroSectionProps {
  github?: string | null;
  activeShiftId?: string | null;
}

export function HeroSection({ github, activeShiftId }: HeroSectionProps) {
  // ── Entrance stage
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(1), TIMING.eyebrow));
    timers.push(setTimeout(() => setStage(2), TIMING.headline));
    timers.push(setTimeout(() => setStage(3), TIMING.lede));
    timers.push(setTimeout(() => setStage(4), TIMING.cta));
    timers.push(setTimeout(() => setStage(5), TIMING.facts));
    timers.push(setTimeout(() => setStage(6), TIMING.note));
    return () => timers.forEach(clearTimeout);
  }, []);

  // ── Desk lamp
  const panelRef    = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const rawLampX = useMotionValue(50);  // percentage 0–100
  const rawLampY = useMotionValue(50);
  const lampX    = useSpring(rawLampX, LAMP_SPRING);
  const lampY    = useSpring(rawLampY, LAMP_SPRING);

  const lampGradient = useMotionTemplate`radial-gradient(
    ellipse 380px 280px at ${lampX}% ${lampY}%,
    rgba(255, 195, 100, 0.11) 0%,
    rgba(255, 170,  60, 0.04) 48%,
    transparent 68%
  )`;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top)  / rect.height;
      rawLampX.set(relX * 100);
      rawLampY.set(relY * 100);
      setIsHovered(true);
    },
    [rawLampX, rawLampY],
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <section
      className="hero-panel"
      ref={panelRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Layer 0: desk lamp glow — follows cursor ── */}
      <motion.div
        className="hero-panel__lamp"
        style={{ background: lampGradient }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      {/* ── Layer 1: paper grain texture (CSS background) ── */}
      <div className="hero-panel__grain" aria-hidden />

      {/* ── Layer 2: content ── */}
      <div className="hero-panel__copy">
          <motion.p
            className="eyebrow"
            initial={{ opacity: 0, y: EYEBROW.offsetY }}
            animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : EYEBROW.offsetY }}
            transition={EYEBROW.spring}
          >
            1963 Switchboard Challenge — by Firecrawl
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, scale: HEADLINE.initialScale }}
            animate={{ opacity: stage >= 2 ? 1 : 0, scale: stage >= 2 ? 1 : HEADLINE.initialScale }}
            transition={HEADLINE.spring}
          >
            <span style={{ color: "var(--accent)" }}>Firecrawl</span> Exchange
          </motion.h1>

          <motion.p
            className="hero-panel__lede"
            initial={{ opacity: 0, y: LEDE.offsetY }}
            animate={{ opacity: stage >= 3 ? 1 : 0, y: stage >= 3 ? 0 : LEDE.offsetY }}
            transition={LEDE.spring}
          >
            One public coding challenge. One live telephone exchange. Your browser
            is only the control surface; the real work happens in the evidence
            bundle and the code you prepare off-board.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: CTA.initialScale }}
            animate={{ opacity: stage >= 4 ? 1 : 0, scale: stage >= 4 ? 1 : CTA.initialScale }}
            transition={CTA.spring}
          >
            <SessionControls github={github} activeShiftId={activeShiftId} />
          </motion.div>

          <div className="hero-panel__facts">
            {FACTS.items.map((item, i) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, y: FACTS.offsetY }}
                animate={{ opacity: stage >= 5 ? 1 : 0, y: stage >= 5 ? 0 : FACTS.offsetY }}
                transition={{ ...FACTS.spring, delay: i * FACTS.stagger }}
              >
                {item}
              </motion.span>
            ))}
          </div>

          <motion.p
            className="hero-panel__note"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 6 ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            Official play is desktop-only. Landing pages and Shift Reports remain
            open to mobile browsers.
          </motion.p>
      </div>
    </section>
  );
}
