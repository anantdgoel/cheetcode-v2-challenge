import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ConvexHttpClient } from 'convex/browser'
import { SignJWT, importPKCS8 } from 'jose'
import { api } from '../convex/_generated/api.js'
import { buildHiringBarPolicySource, inferHiringBarModelFromArtifacts } from './v3-agent-policies.mjs'

const baseUrl = process.env.BENCHMARK_BASE_URL ?? 'http://127.0.0.1:3000'
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const githubLogin = process.env.BENCHMARK_GITHUB_LOGIN ?? 'benchmark-agent'
const convexPrivateKey = process.env.CONVEX_AUTH_PRIVATE_KEY
const codexModel = process.env.BENCHMARK_CODEX_MODEL ?? 'gpt-5.1-codex-mini'
const codexTimeoutMs = Number(process.env.BENCHMARK_CODEX_TIMEOUT_MS ?? '45000')
const pollIntervalMs = Number(process.env.BENCHMARK_POLL_INTERVAL_MS ?? '250')
const probeTimeoutMs = Number(process.env.BENCHMARK_PROBE_TIMEOUT_MS ?? '45000')
const finalTimeoutMs = Number(process.env.BENCHMARK_FINAL_TIMEOUT_MS ?? '60000')

const CONVEX_TOKEN_ISSUER = 'https://madison-exchange.firecrawl.dev'
const CONVEX_TOKEN_AUDIENCE = 'madison-exchange'
const CONVEX_TOKEN_TTL_SECONDS = 3600

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL is required to run the Convex-backed user-flow benchmark')
}

if (!convexPrivateKey) {
  throw new Error('CONVEX_AUTH_PRIVATE_KEY is required to mint a benchmark Convex auth token')
}

async function createConvexToken () {
  const normalizedPrivateKey = convexPrivateKey.replace(/\\n/g, '\n')
  const key = await importPKCS8(normalizedPrivateKey, 'RS256')

  return new SignJWT({ github: githubLogin })
    .setProtectedHeader({ alg: 'RS256', kid: 'convex-auth-key', typ: 'JWT' })
    .setSubject(githubLogin)
    .setIssuer(CONVEX_TOKEN_ISSUER)
    .setAudience(CONVEX_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CONVEX_TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sortedEntries (record) {
  return Object.entries(record ?? {}).sort((left, right) => right[1] - left[1])
}

function takeTopEntries (record, count) {
  return sortedEntries(record)
    .slice(0, count)
    .map(([key, value]) => ({ key, value: Number(value.toFixed ? value.toFixed(3) : value) }))
}

function buildArtifactSummary (artifacts) {
  const model = inferHiringBarModelFromArtifacts(artifacts)
  const fragileGroups = Object.entries(model.groupTraits ?? {})
    .map(([groupId, traits]) => ({
      groupId,
      visibleFamily: model.visibleFamilyByGroup[groupId] ?? 'district',
      collapseRisk: Number(((traits?.[0] ?? 0) + (traits?.[1] ?? 0)).toFixed(3)),
      queueRisk: Number((traits?.[2] ?? 0).toFixed(3)),
      premiumFragility: Number((traits?.[3] ?? 0).toFixed(3)),
      reliability: Number((traits?.[7] ?? 0).toFixed(3))
    }))
    .sort(
      (left, right) =>
        right.collapseRisk + right.premiumFragility - left.collapseRisk - left.premiumFragility
    )
    .slice(0, 8)

  return {
    inferredProfiles: takeTopEntries(model.inferredProfilePosterior, 3),
    familyCountPosterior: takeTopEntries(model.familyCountPosterior, 3),
    visibleFamilyTraits: Object.fromEntries(
      Object.entries(model.visibleFamilyTraits ?? {}).map(([family, traits]) => [
        family,
        {
          collapseRisk: Number((((traits?.[0] ?? 0) + (traits?.[1] ?? 0)) / 2).toFixed(3)),
          queueRisk: Number((traits?.[2] ?? 0).toFixed(3)),
          premiumFragility: Number((traits?.[3] ?? 0).toFixed(3)),
          reliability: Number((traits?.[7] ?? 0).toFixed(3))
        }
      ])
    ),
    fragileGroups
  }
}

function compactProbeSummary (summary) {
  if (!summary) return null
  return {
    probeKind: summary.probeKind,
    deskCondition: summary.deskCondition,
    metrics: summary.metrics,
    failureModes: summary.failureModes,
    modeConfidence: summary.modeConfidence,
    transferWarning: summary.transferWarning,
    recommendedQuestions: summary.recommendedQuestions,
    chiefOperatorNotes: summary.chiefOperatorNotes,
    counterfactualNotes: summary.counterfactualNotes,
    weakestLineGroups: [...(summary.lineGroupTable ?? [])]
      .sort((left, right) => left.connectRate - right.connectRate || right.faultRate - left.faultRate)
      .slice(0, 6),
    worstLoadBands: [...(summary.loadBandTable ?? [])]
      .sort((left, right) => left.connectRate - right.connectRate || right.dropRate - left.dropRate)
      .slice(0, 4),
    failureBuckets: (summary.failureBuckets ?? []).slice(0, 5),
    incidents: (summary.incidents ?? []).slice(0, 5)
  }
}

function extractJsonFromLlmResponse (content) {
  const trimmed = String(content ?? '').trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    // Fall through to fenced-block parsing.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (!fenced?.[1]) return null
  try {
    return JSON.parse(fenced[1])
  } catch {
    return null
  }
}

function buildRewritePrompt ({ artifacts, artifactSummary, fitSummary, stressSummary, currentSource, validationError }) {
  const currentPolicySignals = {
    bytes: new TextEncoder().encode(currentSource).length,
    usesInit: currentSource.includes('function init'),
    usesPremiumHeatState:
      currentSource.includes('premiumHeatByGroup') || currentSource.includes('premium'),
    usesHoldLogic: currentSource.includes('return null') || currentSource.includes('queuedForSeconds'),
    usesTempoLogic: currentSource.includes('tempo'),
    usesFaultFeedback:
      currentSource.includes('groupFaults') || currentSource.includes('pendingByLine')
  }

  const promptPayload = {
    artifactSummary,
    fitProbe: fitSummary,
    stressProbe: stressSummary,
    currentPolicySignals,
    starterPolicySignals: {
      usesPremiumForPriority: String(artifacts['starter.js']).includes('routeCode === "priority"'),
      bytes: new TextEncoder().encode(String(artifacts['starter.js'])).length
    },
    validationError: validationError ?? null
  }

  return [
    'Tune a Madison Exchange v3.2 routing agent based on artifact and probe evidence.',
    'Return JSON only with keys rationale and tuning.',
    'tuning must contain only numeric fields.',
    'Choose values that make the agent more reactive to the probe evidence, especially pressure, premium reuse, holding, tempo, and observed faults.',
    'Do not emit policy source.',
    'Suggested ranges: holdBias -1..1, all other fields 0.4..1.8.',
    'Do not execute shell commands or edit files.',
    '',
    JSON.stringify(promptPayload, null, 2)
  ].join('\n')
}

function requestPolicyRewrite (prompt) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rewrite-'))
  const outputPath = path.join(tempDir, 'rewrite.json')
  const schemaPath = path.join(tempDir, 'schema.json')

  fs.writeFileSync(
    schemaPath,
    JSON.stringify({
      type: 'object',
      additionalProperties: false,
      required: ['rationale', 'tuning'],
      properties: {
        rationale: { type: 'string' },
        tuning: {
          type: 'object',
          additionalProperties: false,
          required: [
            'holdBias',
            'premiumCaution',
            'stressCaution',
            'queueCaution',
            'tempoCaution',
            'faultCaution',
            'governmentPriority',
            'businessPriority'
          ],
          properties: {
            holdBias: { type: 'number' },
            premiumCaution: { type: 'number' },
            stressCaution: { type: 'number' },
            queueCaution: { type: 'number' },
            tempoCaution: { type: 'number' },
            faultCaution: { type: 'number' },
            governmentPriority: { type: 'number' },
            businessPriority: { type: 'number' }
          }
        }
      }
    })
  )

  const args = [
    'exec',
    '--skip-git-repo-check',
    '--color',
    'never',
    '-s',
    'read-only',
    '-C',
    process.cwd(),
    '--output-schema',
    schemaPath,
    '-o',
    outputPath,
    '-'
  ]

  if (codexModel) {
    args.splice(1, 0, '-m', codexModel)
  }

  const result = spawnSync('codex', args, {
    cwd: process.cwd(),
    input: prompt,
    encoding: 'utf8',
    timeout: codexTimeoutMs
  })

  try {
    if (result.error) {
      const errorMessage =
        result.error.name === 'TimeoutError'
          ? `codex rewrite timed out after ${codexTimeoutMs}ms`
          : result.error.message
      throw new Error(errorMessage)
    }
    if (result.status !== 0) {
      throw new Error(
        `codex rewrite failed (${result.status ?? 'unknown'}): ${(result.stderr || result.stdout || '').trim()}`
      )
    }

    const content = fs.readFileSync(outputPath, 'utf8')
    return content
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeRewriteTuning (candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  return {
    holdBias: clamp(Number(candidate.holdBias ?? 0), -1, 1),
    premiumCaution: clamp(Number(candidate.premiumCaution ?? 1), 0.4, 1.8),
    stressCaution: clamp(Number(candidate.stressCaution ?? 1), 0.4, 1.8),
    queueCaution: clamp(Number(candidate.queueCaution ?? 1), 0.4, 1.8),
    tempoCaution: clamp(Number(candidate.tempoCaution ?? 1), 0.4, 1.8),
    faultCaution: clamp(Number(candidate.faultCaution ?? 1), 0.4, 1.8),
    governmentPriority: clamp(Number(candidate.governmentPriority ?? 1), 0.4, 1.8),
    businessPriority: clamp(Number(candidate.businessPriority ?? 1), 0.4, 1.8)
  }
}

function getRunById (shift, runId) {
  if (!shift) return null
  return (shift.runs ?? []).find((run) => run.id === runId) ?? null
}

async function waitForRunCompletion (client, shiftId, runId, timeoutMs) {
  const startedAt = Date.now()
  let lastShift = null
  let lastRun = null

  while (Date.now() - startedAt < timeoutMs) {
    const shift = await client.query(api.sessions.getMyShift, { shiftId })
    const run = getRunById(shift, runId)
    lastShift = shift
    lastRun = run
    if (run?.state === 'completed') {
      return { run, shift }
    }
    await sleep(pollIntervalMs)
  }

  throw new Error(
    `run ${runId} did not complete within ${timeoutMs}ms (lastRunState=${lastRun?.state ?? 'missing'}, shiftState=${lastShift?.state ?? 'unknown'})`
  )
}

async function saveAndValidateDraft (client, shiftId, source) {
  await client.action(api.shiftActions.saveDraft, { shiftId, source })
  return client.action(api.shiftActions.validateDraft, { shiftId, source })
}

function isRecoverableProbeError (error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('trial window closed') || message.includes('all probes exhausted')
}

async function attemptProbe (client, shiftId) {
  try {
    const request = await client.mutation(api.sessions.requestProbe, { shiftId })
    const result = await waitForRunCompletion(client, shiftId, request.runId, probeTimeoutMs)
    return {
      error: null,
      kind: request.probeKind,
      requested: true,
      run: result.run
    }
  } catch (error) {
    if (!isRecoverableProbeError(error)) {
      throw error
    }

    return {
      error: error instanceof Error ? error.message : String(error),
      kind: null,
      requested: false,
      run: null
    }
  }
}

const convexToken = await createConvexToken()
const client = new ConvexHttpClient(convexUrl)
client.setAuth(convexToken)

const startBody = await client.action(api.shiftActions.startShift, {})
const shiftId = (startBody.kind === 'active_shift_exists' ? startBody.activeShiftId : startBody.shift.id)

if (!shiftId) {
  throw new Error(`no active shift available after start flow: ${JSON.stringify(startBody)}`)
}

const artifactNames = ['manual.md', 'starter.js', 'lines.json', 'observations.jsonl']
const artifacts = {}
for (const name of artifactNames) {
  const content = await client.query(api.sessions.getArtifactContent, {
    shiftId,
    name
  })
  if (!content) {
    throw new Error(`artifact ${name} unavailable for shift ${shiftId}`)
  }
  artifacts[name] = content
}

const policySource = buildHiringBarPolicySource({
  manualMd: artifacts['manual.md'],
  starterJs: artifacts['starter.js'],
  linesJson: artifacts['lines.json'],
  observationsJsonl: artifacts['observations.jsonl']
})
const artifactSummary = buildArtifactSummary({
  manualMd: artifacts['manual.md'],
  starterJs: artifacts['starter.js'],
  linesJson: artifacts['lines.json'],
  observationsJsonl: artifacts['observations.jsonl']
})

const initialValidateBody = await saveAndValidateDraft(client, shiftId, policySource)

const firstProbe = await attemptProbe(client, shiftId)
const secondProbe = await attemptProbe(client, shiftId)

let finalPolicySource = policySource
const rewrite = {
  enabled: true,
  attempted: true,
  accepted: false,
  attempts: 0,
  error: null
}

rewrite.attempts = 1
try {
  const rawCompletion = requestPolicyRewrite(
    buildRewritePrompt({
      artifacts,
      artifactSummary,
      fitSummary: compactProbeSummary(firstProbe.run?.probeSummary),
      stressSummary: compactProbeSummary(secondProbe.run?.probeSummary),
      currentSource: finalPolicySource,
      validationError: null
    })
  )
  const parsed = extractJsonFromLlmResponse(rawCompletion)
  const tuning = normalizeRewriteTuning(parsed?.tuning)
  if (tuning) {
    const candidateSource = buildHiringBarPolicySource(
      {
        manualMd: artifacts['manual.md'],
        starterJs: artifacts['starter.js'],
        linesJson: artifacts['lines.json'],
        observationsJsonl: artifacts['observations.jsonl']
      },
      tuning
    )

    await saveAndValidateDraft(client, shiftId, candidateSource)
    finalPolicySource = candidateSource
    rewrite.accepted = true
  } else {
    rewrite.error = 'LLM response did not contain a parseable tuning object.'
  }
} catch (error) {
  rewrite.error = error instanceof Error ? error.message : String(error)
}

const finalValidateBody =
  finalPolicySource === policySource && !rewrite.accepted
    ? initialValidateBody
    : await saveAndValidateDraft(client, shiftId, finalPolicySource)

const goLiveBody = await client.mutation(api.sessions.requestGoLive, { shiftId })
const finalRunResult = await waitForRunCompletion(client, shiftId, goLiveBody.runId, finalTimeoutMs)
const completedShift = finalRunResult.shift
const reportPublicId = completedShift?.reportPublicId ?? finalRunResult.run?.reportPublicId ?? null
const report = reportPublicId
  ? await client.query(api.reports.getReportByPublicId, { publicId: reportPublicId })
  : null

console.log(
  JSON.stringify(
    {
      actor: githubLogin,
      baseUrl,
      convexUrl,
      shiftId,
      fetchedArtifacts: artifactNames,
      initialValidatedAt: initialValidateBody?.shift?.latestValidAt ?? null,
      finalValidatedAt: finalValidateBody?.shift?.latestValidAt ?? null,
      llmRewrite: rewrite,
      probes: [
        {
          kind: firstProbe.kind,
          efficiency: firstProbe.run?.probeSummary?.metrics?.efficiency ?? null,
          transferWarning: firstProbe.run?.probeSummary?.transferWarning ?? null,
          requested: firstProbe.requested,
          error: firstProbe.error
        },
        {
          kind: secondProbe.kind,
          efficiency: secondProbe.run?.probeSummary?.metrics?.efficiency ?? null,
          transferWarning: secondProbe.run?.probeSummary?.transferWarning ?? null,
          requested: secondProbe.requested,
          error: secondProbe.error
        }
      ],
      finalReportPublicId: reportPublicId,
      finalReportUrl: reportPublicId ? `${baseUrl}/report/${reportPublicId}` : null,
      finalEfficiency: finalRunResult.run?.metrics?.efficiency ?? null,
      finalTitle: finalRunResult.run?.title ?? null,
      report
    },
    null,
    2
  )
)
