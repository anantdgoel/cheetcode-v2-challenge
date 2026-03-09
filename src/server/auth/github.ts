import { auth } from '../../../auth'

export async function getGithubUsername () {
  const session = await auth()
  return (session?.user as { githubUsername?: string } | undefined)?.githubUsername ?? null
}

export function isAdminGithub (github: string | null) {
  if (!github) return false
  const raw = process.env.ADMIN_GITHUB_LOGINS ?? ''
  const allowlist = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return allowlist.includes(github)
}
