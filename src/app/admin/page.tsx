import { redirect } from 'next/navigation'
import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { getAdminSnapshot } from '@/lib/shifts'
import { getGithubUsername, isAdminGithub } from '@/lib/server-auth'
import { normalizeSearchParam } from '@/lib/validation'

export const dynamic = 'force-dynamic'

function parseParam (params: Record<string, string | string[] | undefined>, name: string) {
  return normalizeSearchParam(
    Array.isArray(params[name]) ? params[name][0] : params[name] ?? null
  )
}

export default async function AdminPage ({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [github, params] = await Promise.all([getGithubUsername(), searchParams])
  if (!isAdminGithub(github)) {
    redirect('/')
  }
  const lookupGithub = parseParam(params, 'github')
  const shiftId = parseParam(params, 'shiftId')
  const publicId = parseParam(params, 'publicId')

  const snapshot = await getAdminSnapshot({
    github: lookupGithub,
    shiftId,
    publicId
  })

  const fieldDefaults: Record<string, string> = {
    github: lookupGithub ?? '',
    shiftId: shiftId ?? '',
    publicId: publicId ?? ''
  }
  return <AdminPageContent fieldDefaults={fieldDefaults} snapshot={snapshot} />
}
