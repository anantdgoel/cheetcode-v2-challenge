import type { FinalReport, Title } from "@/lib/contracts/game";
import { createRng } from "./shared";
import { getTitleForScore } from "./scoring";

function buildChiefOperatorNote(title: Title, hiddenScore: number, seed: string) {
  const rng = createRng(`${seed}:${title}:${hiddenScore}`);
  const notes: Record<Title, string[]> = {
    chief_operator: [
      "The room stayed under your hand, even when the lamps climbed and the trunks started to look tempting.",
      "A clean, cold shift. You made the board feel smaller than it is.",
    ],
    senior_operator: [
      "Strong deskwork. A few hot minutes, but the room mostly obeyed.",
      "The board strained, not you.",
    ],
    operator: [
      "A working shift. Not elegant, but the city kept talking.",
      "Useful judgment, though the queue got the better of you more than once.",
    ],
    trainee: [
      "There were moments of discipline, surrounded by a lot of nervous reaching.",
      "The room cleared eventually. That is not the same as commanding it.",
    ],
    off_the_board: [
      "Madison Avenue has seen rougher nights, but not many with this many self-inflicted wounds.",
      "The lamps were trying to teach you something. You did not quite listen in time.",
    ],
  };
  const options = notes[title];
  return options[Math.floor(rng() * options.length)]!;
}

export function buildReport(params: {
  shiftId: string;
  github: string;
  publicId: string;
  achievedAt: number;
  kind: "final" | "auto_final";
  metrics: import("@/lib/contracts/game").SimulationMetrics;
  seed: string;
}): FinalReport {
  const title = getTitleForScore(params.metrics.hiddenScore);
  return {
    publicId: params.publicId,
    shiftId: params.shiftId,
    github: params.github,
    title,
    boardEfficiency: params.metrics.efficiency,
    connectedCalls: params.metrics.connectedCalls,
    totalCalls: params.metrics.totalCalls,
    droppedCalls: params.metrics.droppedCalls,
    avgHoldSeconds: params.metrics.avgHoldSeconds,
    premiumTrunkUsage: params.metrics.premiumUsageCount,
    chiefOperatorNote: buildChiefOperatorNote(title, params.metrics.hiddenScore, params.seed),
    achievedAt: params.achievedAt,
    hiddenScore: params.metrics.hiddenScore,
    kind: params.kind,
  };
}

export function formatTitle(title: Title) {
  return title.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
