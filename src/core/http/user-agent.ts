const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i

export function isDesktopUserAgent (userAgent: string | null): boolean {
  if (!userAgent) return true
  return !MOBILE_USER_AGENT_PATTERN.test(userAgent)
}
