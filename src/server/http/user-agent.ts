export function isDesktopUserAgent (userAgent: string | null): boolean {
  if (!userAgent) return true
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent
  )
}
