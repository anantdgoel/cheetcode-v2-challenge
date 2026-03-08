import type { ArtifactName, PublicLine } from '@/core/domain/game'
import type { BoardModel, LineModel, ObservationRow, ShiftArtifacts } from './models'
import { createBoard } from './board-generation'
import { createObservations } from './observation-generation'

function stringifyLines (board: BoardModel) {
  return JSON.stringify(
    board.lines.map<PublicLine>(
      ({ id, label, switchMark, classTags, lineGroupId, isPremiumTrunk, maintenanceBand }: LineModel) => ({
        id,
        label,
        switchMark,
        classTags,
        lineGroupId,
        isPremiumTrunk,
        maintenanceBand
      })
    ),
    null,
    2
  )
}

function stringifyObservations (board: BoardModel) {
  return createObservations(board).map((row: ObservationRow) => JSON.stringify(row)).join('\n')
}

function buildManual (board: BoardModel) {
  const lineGroups = Array.from(new Set(board.lines.map((line) => line.lineGroupId))).length
  return `# Firecrawl Exchange — Operator Manual

I left this for whoever takes the next shift.

The desk is yours now. I kept it clean, wrote down what I could, and left the files in order. You'll figure out the rest — everybody does. The board teaches you whether you want it to or not.

Don't let the first few minutes rattle you. It's loud, then it makes sense, then it's loud again. That's normal.

## The Contract

They don't ask much. One file, two functions, and whatever judgment you bring to the chair.

You submit one JavaScript file. The runtime calls two functions:

    init(context)      // optional — called once at the start of a run
    connect(input)     // required — called once per incoming call

\`connect\` must return:

    { lineId: string | null }

Return a line ID to route the call. Return \`null\` to hold.

State you set in \`init\` or \`connect\` persists for the duration of a run, then resets.

## The Board

When a call comes in, this is what lands on your desk:

**clock**
- \`second\`
- \`remainingSeconds\`

**board**
- \`load\`
- \`pressure\`
- \`queueDepth\`
- \`callsHandled\`
- \`tempo\`

**call**
- \`id\`
- \`routeCode\`
- \`subscriberClass\`
- \`billingMode\`
- \`urgency\`
- \`queuedForSeconds\`
- \`attempt\`

**lines[]**
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

## What I Left You

I didn't have to leave these. Most people don't. But I sat in this chair cold once and I wouldn't wish that on anyone.

Four files in the desk:

- \`manual.md\` — you're reading it
- \`starter.js\` — nothing special, but it runs. Start there if you want something on the board while you think
- \`lines.json\` — the full inventory of lines on this board, everything static you'd want to know
- \`observations.jsonl\` — records I kept from previous traffic on this board. I tried my best

## If You Need a Second Opinion

There's a trial button on the console. Press it and I'll see how I can help. Use it strategically — I have a life.

Either way, easier to fix things before the board is watching for real.

## What They're Watching

They care about connections. That's the job — get callers routed.

Board Efficiency goes up on the wall. The rest, you'll figure out.

## This Board

${board.lines.length} lines, ${lineGroups} groups.

Good luck. You won't need it if you read the files.

I'm going to go get a drink.
`
}

export function buildStarterPolicy () {
  return `function connect(input) {
  const idle = input.lines.filter((line) => line.status === "idle");
  if (!idle.length) return { lineId: null };

  const firstPremium = idle.find((line) => line.isPremiumTrunk);
  if (input.call.routeCode === "priority") {
    return { lineId: firstPremium ? firstPremium.id : idle[0].id };
  }

  return { lineId: null };
}`
}

const ARTIFACT_BUILDERS: Record<ArtifactName, (board: BoardModel) => string> = {
  'manual.md': buildManual,
  'starter.js': () => buildStarterPolicy(),
  'lines.json': stringifyLines,
  'observations.jsonl': stringifyObservations
}

export function buildShiftArtifacts (seedOrBoard: string | BoardModel): ShiftArtifacts {
  const board = typeof seedOrBoard === 'string' ? createBoard(seedOrBoard) : seedOrBoard
  return {
    board,
    manualMd: buildManual(board),
    starterJs: buildStarterPolicy(),
    linesJson: stringifyLines(board),
    observationsJsonl: stringifyObservations(board)
  }
}

export function buildArtifactContent (
  name: ArtifactName,
  seedOrBoard: string | BoardModel
): string {
  const board = typeof seedOrBoard === 'string' ? createBoard(seedOrBoard) : seedOrBoard
  return ARTIFACT_BUILDERS[name](board)
}
