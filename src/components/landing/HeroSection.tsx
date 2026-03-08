"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialKit } from "dialkit";
import SessionControls from "./SessionControls";


/* ─────────────────────────────────────────────────────────
 * SWITCHBOARD ANIMATION STORYBOARD
 *
 * Ambient loop — no trigger, runs continuously after mount.
 * Grid: 4 columns × 5 rows = 20 junction positions.
 *
 *     0ms   mount — all junctions and wires at static rest
 *   400ms   8 active lamps begin pulsing (staggered)
 *   800ms   3 permanent wires begin flowing
 *  1200ms   8 switching wires begin cycling in/out
 *  2000ms   idle junction flicker loop begins (random 3–8s)
 *
 * CONTINUOUS BEHAVIORS (after entrance):
 *   Lamp pulse     — opacity mirror loop, easeInOut, 2.5–5s periods
 *   Wire signal    — strokeDashoffset linear crawl, 2.5–4s periods
 *   Switching wire — opacity envelope (fade in → hold → fade out → off)
 *                    each on its own 10–16s cycle, staggered
 *   Idle flicker   — imperative 0.5s spike on random junction
 * ───────────────────────────────────────────────────────── */

const SB_TIMING = {
  lampStart:      400,    // active lamps begin pulsing
  wireStart:      800,    // permanent wires begin flowing
  switchStart:    1200,   // switching wires begin cycling
  flickerStart:   2000,   // idle flicker loop begins
};

/*
 * Junction grid — 4 cols (80, 200, 320, 440) × 5 rows (80, 180, 280, 380, 480)
 *
 * Active lamps (8):
 *   (320,80)  (80,180) (440,180) (200,280)
 *   (320,280) (80,380) (440,380) (200,480)
 *
 * Idle junctions (12): everything else
 */

const LAMPS = {
  items: [
    { cx: 320, cy: 80,  color: "var(--accent)",  ringOpacity: [0.55, 0.85] as const, dotOpacity: [0.45, 0.8]  as const, period: 3.0, delay: 0 },
    { cx: 80,  cy: 180, color: "var(--gold)",     ringOpacity: [0.45, 0.72] as const, dotOpacity: [0.38, 0.68] as const, period: 4.1, delay: 0.5 },
    { cx: 440, cy: 180, color: "var(--accent)",   ringOpacity: [0.5, 0.78]  as const, dotOpacity: [0.4, 0.72]  as const, period: 3.5, delay: 1.0 },
    { cx: 200, cy: 280, color: "var(--success)",  ringOpacity: [0.45, 0.7]  as const, dotOpacity: [0.38, 0.65] as const, period: 3.8, delay: 0.3 },
    { cx: 320, cy: 280, color: "var(--gold)",     ringOpacity: [0.48, 0.74] as const, dotOpacity: [0.4, 0.68]  as const, period: 4.4, delay: 1.4 },
    { cx: 80,  cy: 380, color: "var(--accent)",   ringOpacity: [0.5, 0.76]  as const, dotOpacity: [0.42, 0.7]  as const, period: 2.9, delay: 0.8 },
    { cx: 440, cy: 380, color: "var(--gold)",     ringOpacity: [0.45, 0.7]  as const, dotOpacity: [0.38, 0.65] as const, period: 4.8, delay: 0.2 },
    { cx: 200, cy: 480, color: "var(--success)",  ringOpacity: [0.48, 0.72] as const, dotOpacity: [0.4, 0.66]  as const, period: 3.6, delay: 1.1 },
  ],
  ringR: 14,
  dotR: 5,
  dotScale: [1, 1.15] as const,
};

const IDLE_JUNCTIONS = {
  items: [
    { cx: 80,  cy: 80 },  { cx: 200, cy: 80 },  { cx: 440, cy: 80 },
    { cx: 200, cy: 180 }, { cx: 320, cy: 180 },
    { cx: 80,  cy: 280 }, { cx: 440, cy: 280 },
    { cx: 200, cy: 380 }, { cx: 320, cy: 380 },
    { cx: 80,  cy: 480 }, { cx: 320, cy: 480 }, { cx: 440, cy: 480 },
  ],
  ringR: 12,
  dotR: 4,
  flickerMinMs: 3000,     // faster flicker for more activity
  flickerMaxMs: 8000,
  flickerDuration: 0.5,
  flickerPeakRing: 0.3,
  flickerPeakDot: 0.22,
};

/* Permanent wires — always flowing */
const WIRES = {
  items: [
    { d: "M320 80 C350 120, 110 150, 80 180",     color: "var(--accent)", strokeWidth: 2,   opacity: 0.35, dasharray: "8 32", period: 2.8, delay: 0 },
    { d: "M200 280 C160 320, 100 350, 80 380",    color: "var(--gold)",   strokeWidth: 2,   opacity: 0.3,  dasharray: "6 34", period: 3.4, delay: 0.8 },
    { d: "M320 80 C380 160, 460 280, 440 380",    color: "var(--accent)", strokeWidth: 1.5, opacity: 0.2,  dasharray: "10 30", period: 3.8, delay: 1.5 },
  ],
  dashTotal: -40,
};

/*
 * Switching wires — fade in/out on independent cycles.
 * Creates the illusion of an operator patching and unpatching connections.
 * Each wire has:
 *   cyclePeriod  — total seconds for one full on/off cycle
 *   onFraction   — what portion of the cycle the wire is visible (0–1)
 *   delay        — offset to stagger cycles
 *   flowPeriod   — strokeDashoffset crawl speed (only while visible)
 */
const SWITCHING_WIRES = {
  items: [
    // Short patch connections
    { d: "M80 180 C125 210, 165 250, 200 280",    color: "var(--gold)",    peakOpacity: 0.3,  cyclePeriod: 11,  onFraction: 0.45, delay: 0,    flowPeriod: 2.5 },
    { d: "M320 80 C370 110, 420 145, 440 180",    color: "var(--accent)",  peakOpacity: 0.25, cyclePeriod: 13,  onFraction: 0.4,  delay: 2.5,  flowPeriod: 2.8 },
    { d: "M320 280 C365 310, 410 345, 440 380",   color: "var(--gold)",    peakOpacity: 0.28, cyclePeriod: 10,  onFraction: 0.5,  delay: 5.0,  flowPeriod: 2.4 },
    { d: "M80 380 C120 410, 160 450, 200 480",    color: "var(--success)", peakOpacity: 0.25, cyclePeriod: 14,  onFraction: 0.4,  delay: 1.5,  flowPeriod: 3.0 },
    // Long sweeping cross-connections
    { d: "M440 380 C390 420, 260 460, 200 480",   color: "var(--accent)",  peakOpacity: 0.2,  cyclePeriod: 15,  onFraction: 0.35, delay: 4.0,  flowPeriod: 3.5 },
    { d: "M320 80 C280 160, 220 230, 200 280",    color: "var(--accent)",  peakOpacity: 0.2,  cyclePeriod: 12,  onFraction: 0.42, delay: 7.0,  flowPeriod: 3.2 },
    { d: "M80 180 C160 210, 270 250, 320 280",    color: "var(--gold)",    peakOpacity: 0.22, cyclePeriod: 16,  onFraction: 0.38, delay: 3.0,  flowPeriod: 3.6 },
    { d: "M440 180 C400 220, 360 255, 320 280",   color: "var(--accent)",  peakOpacity: 0.22, cyclePeriod: 11,  onFraction: 0.45, delay: 8.5,  flowPeriod: 2.6 },
  ],
  dasharray: "6 34",
  strokeWidth: 1.5,
  fadeSeconds: 0.8,     // fade in/out duration within the envelope
};

/* Idle junction rest colors */
const IDLE_RING_STROKE = "rgba(26,20,16,0.12)";
const IDLE_DOT_FILL = "rgba(26,20,16,0.08)";

export function SwitchboardPattern() {
  const prefersReduced = useReducedMotion();
  const [sbStage, setSbStage] = useState(0);

  /* Refs for imperative flicker on idle junctions */
  const idleRingRefs = useRef<(SVGCircleElement | null)[]>([]);
  const idleDotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const flickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* DialKit live-tuning */
  const params = useDialKit("Switchboard", {
    lamps: {
      period:   [2.5, 1, 8],
      ringPeak: [0.75, 0.5, 1],
      dotScale: [1.33, 1, 1.4],
    },
    wires: {
      period:     [1.5, 1, 8],
      dashLength: [15, 4, 20],
    },
    switching: {
      cycleScale: [1, 0.3, 3],
      onFraction: [0.75, 0.2, 0.8],
    },
    flicker: {
      interval: [3, 2, 15],
      duration:  [0.4, 0.2, 1.5],
    },
    replay: { type: "action" as const },
  }, {
    onAction: (action: string) => {
      if (action === "replay") {
        setSbStage(0);
      }
    },
  });

  /* Stage-driven entrance */
  useEffect(() => {
    if (prefersReduced) {
      setSbStage(4);
      return;
    }

    setSbStage(0);
    const timers = [
      setTimeout(() => setSbStage(1), SB_TIMING.lampStart),
      setTimeout(() => setSbStage(2), SB_TIMING.wireStart),
      setTimeout(() => setSbStage(3), SB_TIMING.switchStart),
      setTimeout(() => setSbStage(4), SB_TIMING.flickerStart),
    ];
    return () => timers.forEach(clearTimeout);
  }, [prefersReduced, params.replay]);

  /* Idle flicker loop — imperative animate() on random junctions */
  const scheduleFlicker = useCallback(() => {
    if (prefersReduced) return;

    const minMs = (params.flicker.interval - 2) * 1000;
    const maxMs = (params.flicker.interval + 4) * 1000;
    const nextMs = minMs + Math.random() * (maxMs - minMs);

    flickerTimerRef.current = setTimeout(() => {
      const idx = Math.floor(Math.random() * IDLE_JUNCTIONS.items.length);
      const ring = idleRingRefs.current[idx];
      const dot = idleDotRefs.current[idx];

      if (ring) {
        animate(ring, { opacity: [0.12, IDLE_JUNCTIONS.flickerPeakRing, 0.12] }, {
          duration: params.flicker.duration,
          ease: "easeInOut",
        });
      }
      if (dot) {
        animate(dot, { opacity: [0.08, IDLE_JUNCTIONS.flickerPeakDot, 0.08] }, {
          duration: params.flicker.duration,
          ease: "easeInOut",
        });
      }
      scheduleFlicker();
    }, nextMs);
  }, [prefersReduced, params.flicker.interval, params.flicker.duration]);

  useEffect(() => {
    if (sbStage < 4) return;
    scheduleFlicker();
    return () => {
      if (flickerTimerRef.current) clearTimeout(flickerTimerRef.current);
    };
  }, [sbStage, scheduleFlicker]);

  /* Reduced motion — render static SVG */
  if (prefersReduced) {
    return (
      <div className="switchboard-pattern" aria-hidden>
        <svg width="520" height="560" viewBox="0 0 520 560" fill="none">
          {LAMPS.items.map((l, i) => (
            <g key={`lamp-static-${i}`}>
              <circle cx={l.cx} cy={l.cy} r={LAMPS.ringR} stroke={l.color} strokeWidth="2" fill="none" opacity={l.ringOpacity[1]} />
              <circle cx={l.cx} cy={l.cy} r={LAMPS.dotR} fill={l.color} opacity={l.dotOpacity[1]} />
            </g>
          ))}
          {IDLE_JUNCTIONS.items.map((j, i) => (
            <g key={`idle-static-${i}`}>
              <circle cx={j.cx} cy={j.cy} r={IDLE_JUNCTIONS.ringR} stroke={IDLE_RING_STROKE} strokeWidth="1.5" fill="none" />
              <circle cx={j.cx} cy={j.cy} r={IDLE_JUNCTIONS.dotR} fill={IDLE_DOT_FILL} />
            </g>
          ))}
          {WIRES.items.map((w, i) => (
            <path key={`wire-static-${i}`} d={w.d} stroke={w.color} strokeWidth={w.strokeWidth} fill="none" opacity={w.opacity} />
          ))}
          {SWITCHING_WIRES.items.map((sw, i) => (
            <path key={`sw-static-${i}`} d={sw.d} stroke={sw.color} strokeWidth={SWITCHING_WIRES.strokeWidth} fill="none" opacity={sw.peakOpacity * 0.6} />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="switchboard-pattern" aria-hidden>
      <svg width="520" height="560" viewBox="0 0 520 560" fill="none">
        <defs>
          <filter id="wire-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Idle junctions — imperatively flickered */}
        {IDLE_JUNCTIONS.items.map((j, i) => (
          <g key={`idle-${i}`}>
            <circle
              ref={(el) => { idleRingRefs.current[i] = el; }}
              cx={j.cx} cy={j.cy} r={IDLE_JUNCTIONS.ringR}
              stroke={IDLE_RING_STROKE} strokeWidth="1.5" fill="none" opacity={0.12}
            />
            <circle
              ref={(el) => { idleDotRefs.current[i] = el; }}
              cx={j.cx} cy={j.cy} r={IDLE_JUNCTIONS.dotR}
              fill={IDLE_DOT_FILL} opacity={0.08}
            />
          </g>
        ))}

        {/* Active lamps — declarative pulse loops */}
        {LAMPS.items.map((l, i) => {
          const periodScale = params.lamps.period / 3.5;
          const period = l.period * periodScale;
          const ringPeak = Math.min(l.ringOpacity[1] * (params.lamps.ringPeak / 0.85), 1);
          const dotScaleMax = params.lamps.dotScale;

          return (
            <g key={`lamp-${i}`}>
              <motion.circle
                cx={l.cx} cy={l.cy} r={LAMPS.ringR}
                stroke={l.color} strokeWidth="2" fill="none"
                initial={{ opacity: l.ringOpacity[0] }}
                animate={sbStage >= 1 ? {
                  opacity: [l.ringOpacity[0], ringPeak, l.ringOpacity[0]],
                } : { opacity: l.ringOpacity[0] }}
                transition={sbStage >= 1 ? {
                  duration: period,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: l.delay,
                } : undefined}
              />
              <motion.circle
                cx={l.cx} cy={l.cy} r={LAMPS.dotR}
                fill={l.color}
                initial={{ opacity: l.dotOpacity[0], scale: LAMPS.dotScale[0] }}
                animate={sbStage >= 1 ? {
                  opacity: [l.dotOpacity[0], l.dotOpacity[1], l.dotOpacity[0]],
                  scale: [LAMPS.dotScale[0], dotScaleMax, LAMPS.dotScale[0]],
                } : { opacity: l.dotOpacity[0], scale: LAMPS.dotScale[0] }}
                transition={sbStage >= 1 ? {
                  duration: period,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: l.delay,
                } : undefined}
                style={{ transformOrigin: `${l.cx}px ${l.cy}px` }}
              />
            </g>
          );
        })}

        {/* Permanent wires — always flowing */}
        {WIRES.items.map((w, i) => {
          const periodScale = params.wires.period / 3;
          const period = w.period * periodScale;
          const dash = `${params.wires.dashLength} ${40 - params.wires.dashLength}`;

          return (
            <motion.path
              key={`wire-${i}`}
              d={w.d}
              stroke={w.color}
              strokeWidth={w.strokeWidth}
              fill="none"
              opacity={w.opacity}
              strokeDasharray={dash}
              filter="url(#wire-glow)"
              initial={{ strokeDashoffset: 0 }}
              animate={sbStage >= 2 ? {
                strokeDashoffset: WIRES.dashTotal,
              } : { strokeDashoffset: 0 }}
              transition={sbStage >= 2 ? {
                duration: period,
                ease: "linear",
                repeat: Infinity,
                delay: w.delay,
              } : undefined}
            />
          );
        })}

        {/* Switching wires — fade in/out on staggered cycles */}
        {SWITCHING_WIRES.items.map((sw, i) => {
          const cycle = sw.cyclePeriod * params.switching.cycleScale;
          const on = params.switching.onFraction;
          const fadeFrac = SWITCHING_WIRES.fadeSeconds / cycle;
          const offPad = (1 - on) / 2;
          /* opacity keyframes: off → fade in → hold → fade out → off */
          const times = [0, offPad, offPad + fadeFrac, offPad + on - fadeFrac, offPad + on, 1];
          const opacityKf = [0, 0, sw.peakOpacity, sw.peakOpacity, 0, 0];
          const flowPeriod = sw.flowPeriod * params.switching.cycleScale;

          return (
            <motion.path
              key={`sw-${i}`}
              d={sw.d}
              stroke={sw.color}
              strokeWidth={SWITCHING_WIRES.strokeWidth}
              fill="none"
              strokeDasharray={SWITCHING_WIRES.dasharray}
              filter="url(#wire-glow)"
              initial={{ opacity: 0, strokeDashoffset: 0 }}
              animate={sbStage >= 3 ? {
                opacity: opacityKf,
                strokeDashoffset: WIRES.dashTotal,
              } : { opacity: 0 }}
              transition={sbStage >= 3 ? {
                opacity: {
                  duration: cycle,
                  times,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: sw.delay,
                },
                strokeDashoffset: {
                  duration: flowPeriod,
                  ease: "linear",
                  repeat: Infinity,
                  delay: sw.delay,
                },
              } : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function HeroSection({
  activeShiftId,
  github,
}: {
  activeShiftId?: string | null;
  github?: string | null;
}) {
  return (
    <>
      <section className="hero">
        <p className="hero__eyebrow">incoming transmission</p>

        <div className="hero__headline">
          <span className="hero__firecrawl">Firecrawl</span>
          <span className="hero__exchange">Exchange</span>
        </div>

      </section>

      <section className="hero-lede">
        <p className="hero-lede__text">
          San Francisco, 1957. The trunk lines are humming. The board manual says one thing. The
          dispatch log says another. Your shift starts in five minutes.
        </p>

        <div className="hero-lede__cta-row">
          <SessionControls github={github} activeShiftId={activeShiftId} />
          <span className="hero-lede__facts">
            5 min investigation · 1 trial shift · 2 min final board call
          </span>
        </div>
      </section>
    </>
  );
}
