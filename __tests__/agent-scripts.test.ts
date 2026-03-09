import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('benchmark script separation', () => {
  it('keeps the hiring-bar benchmark offline', () => {
    const source = fs.readFileSync('scripts/run-hiring-bar-agent.mjs', 'utf8')

    expect(source.includes('simulateExchange')).toBe(true)
    expect(source.includes('/api/shifts/')).toBe(false)
  })

  it('adds a separate user-flow harness that uses authenticated app routes', () => {
    const source = fs.readFileSync('scripts/run-user-flow-agent.mjs', 'utf8')

    expect(source.includes('ConvexHttpClient')).toBe(true)
    expect(source.includes('client.setAuth(')).toBe(true)
    expect(source.includes('api.shiftActions.startShift')).toBe(true)
    expect(source.includes('api.sessions.requestProbe')).toBe(true)
    expect(source.includes('/api/shifts/')).toBe(false)
    expect(source.includes('buildHiringBarPolicySource')).toBe(true)
    expect(source.includes('gpt-5.1-codex-mini')).toBe(true)
  })
})
