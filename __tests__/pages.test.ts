import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('public surface source', () => {
  it('landing page references Firecrawl Exchange rather than CheetCode', () => {
    const pageSource = fs.readFileSync('src/features/landing/client/HeroSection.tsx', 'utf8')
    expect(pageSource.includes('Firecrawl')).toBe(true)
    expect(pageSource.includes('Exchange')).toBe(true)
    expect(pageSource.includes('CheetCode')).toBe(false)
  })

  it('the app no longer imports the old problem bank', () => {
    const sourceFiles = [
      'src/app/page.tsx'
    ]

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content.includes('server/problems')).toBe(false)
    }
  })
})
