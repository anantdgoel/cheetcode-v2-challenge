'use client'

import { useState } from 'react'
import Image from 'next/image'

export function AdminAvatar ({ github, size }: { github: string; size: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const px = size === 'lg' ? 48 : 20
  const imgSize = size === 'lg' ? 80 : 40

  if (failed) {
    const initial = (github[0] ?? '?').toUpperCase()
    return (
      <div
        className={`admin-avatar-fallback${size === 'lg' ? ' admin-avatar-fallback--lg' : ''}`}
        aria-hidden
      >
        {initial}
      </div>
    )
  }

  return (
    <Image
      className={`admin-avatar${size === 'lg' ? ' admin-avatar--lg' : ''}`}
      src={`https://github.com/${github}.png?size=${imgSize}`}
      alt=''
      width={px}
      height={px}
      unoptimized
      onError={() => { setFailed(true) }}
    />
  )
}
