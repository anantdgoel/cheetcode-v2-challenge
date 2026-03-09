import { describe, expect, it } from 'vitest'
import { isDesktopUserAgent } from '@/core/http/user-agent'

describe('isDesktopUserAgent', () => {
  it('treats desktop browsers as desktop', () => {
    expect(isDesktopUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true)
  })

  it('treats mobile browsers as non-desktop', () => {
    expect(isDesktopUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X)')).toBe(false)
  })

  it('falls back to desktop when the user agent is missing', () => {
    expect(isDesktopUserAgent(null)).toBe(true)
  })
})
