import type { ArtifactName, PublicLine } from "@/lib/domain/game";
import type { BoardModel, LineModel, ObservationRow, ShiftArtifacts } from "./models";
import { createBoard } from "./board-generation";
import { createObservations } from "./observation-generation";

function stringifyLines(board: BoardModel) {
  return JSON.stringify(
    board.lines.map<PublicLine>(
      ({ id, label, switchMark, classTags, lineGroupId, isPremiumTrunk, maintenanceBand }: LineModel) => ({
        id,
        label,
        switchMark,
        classTags,
        lineGroupId,
        isPremiumTrunk,
        maintenanceBand,
      }),
    ),
    null,
    2,
  );
}

function stringifyObservations(board: BoardModel) {
  return createObservations(board).map((row: ObservationRow) => JSON.stringify(row)).join("\n");
}

function buildManual(board: BoardModel) {
  const lineGroups = Array.from(new Set(board.lines.map((line) => line.lineGroupId))).length;
  return `# Madison Exchange — Operator Manual

The room opens hot and crowded, with the old Madison Avenue board humming
like it remembers every bad decision made on it. Your job is not to guess.
It is to build a disciplined routing policy and keep your head when the load rises.

## 1. Submission Contract

Submit one JavaScript policy file.

The runtime calls:

    init(context)      // optional, once per run
    connect(input)     // required, once per decision

\`connect(input)\` must return:

    { lineId: string | null }

Returning \`null\` keeps the caller on hold.
State persists within a probe or final run and resets between runs.

## 2. What Matters

- Different line groups carry different traffic families well.
- Some lines hold up under rising load; others go soft.
- Premium trunks help only in a narrow set of cases.
- The same board law governs both probes and final.

## 3. Live Runtime

Every decision includes:

- \`clock.second\`
- \`clock.remainingSeconds\`
- \`board.load\` from 0 to 1
- \`board.pressure\` from 0 to 1, a noisy live gauge
- \`board.tempo\` to warn when the room is surging or cooling
- \`board.queueDepth\`
- \`call\`
- \`lines\`

Every visible line includes:

- \`id\`
- \`label\`
- \`switchMark\`
- \`classTags\`
- \`lineGroupId\`
- \`isPremiumTrunk\`
- \`maintenanceBand\`
- \`status\`
- \`secondsUntilBusyClears\`
- \`secondsUntilFaultClears\`

## 4. Desk Notes

The room tells on itself if you listen:

- Similar markings often travel together, but never perfectly.
- Some desks look alike and still fail for different reasons when the room turns.
- Some groups carry cleanly until the lamps stack up, then fail fast.
- Premium habit is not premium judgment.
- The expensive room helps most when the call is real trouble, not merely loud trouble.
- The books may flatter a desk that stops telling the truth once the room turns.

## 5. Evidence

- \`manual.md\`: this briefing
- \`starter.js\`: a weak but valid baseline
- \`lines.json\`: the live board inventory
- \`observations.jsonl\`: this board's own historical traffic, useful but noisy

The history is useful because it teaches the habits of this board, not because it hands you a clean answer key.
Visible similarities are suggestive, never absolute. Some operators kept cleaner books than others.

## 6. Probes

Two live probes are available:

- \`fit\`: broad daytime coverage at manageable load
- \`stress\`: denser traffic to expose collapse thresholds

Probe output is structured on purpose. Use it to tune your model, not to search for one magic replacement line.
The probe room will tell you what changed, but not how to patch it.
The final can change pace more than once. A good operator notices before the whole desk notices.

## 7. Scoring

Connections matter most.
Drops hurt.
Excessive holding hurts.
Wasting premium trunks hurts.

You are judged in public on Board Efficiency. The full score remains private.

## 8. The Room

There are ${board.lines.length} live lines on this board, spread across ${lineGroups} visible groups.
The board will not explain itself. It will, however, repeat its habits if you watch closely enough.
`;
}

export function buildStarterPolicy() {
  return `function connect(input) {
  const idle = input.lines.filter((line) => line.status === "idle");
  if (!idle.length) return { lineId: null };

  const firstPremium = idle.find((line) => line.isPremiumTrunk);
  if (input.call.routeCode === "priority") {
    return { lineId: firstPremium ? firstPremium.id : idle[0].id };
  }

  return { lineId: null };
}`;
}

const ARTIFACT_BUILDERS: Record<ArtifactName, (board: BoardModel) => string> = {
  "manual.md": buildManual,
  "starter.js": () => buildStarterPolicy(),
  "lines.json": stringifyLines,
  "observations.jsonl": stringifyObservations,
};

export function buildShiftArtifacts(seedOrBoard: string | BoardModel): ShiftArtifacts {
  const board = typeof seedOrBoard === "string" ? createBoard(seedOrBoard) : seedOrBoard;
  return {
    board,
    manualMd: buildManual(board),
    starterJs: buildStarterPolicy(),
    linesJson: stringifyLines(board),
    observationsJsonl: stringifyObservations(board),
  };
}

export function buildArtifactContent(
  name: ArtifactName,
  seedOrBoard: string | BoardModel,
): string {
  const board = typeof seedOrBoard === "string" ? createBoard(seedOrBoard) : seedOrBoard;
  return ARTIFACT_BUILDERS[name](board);
}
