import { redirect } from 'next/navigation'
import {
  AdminPageContent,
  type AdminFieldDefaults
} from '@/features/admin/client/AdminPageContent'
import { getAdminSnapshot } from '@/features/admin/server/queries'
import { getGithubUsername, isAdminGithub } from '@/server/auth/github'

export const dynamic = 'force-dynamic'

function parseParam (params: Record<string, string | string[] | undefined>, name: string) {
  const raw = Array.isArray(params[name]) ? params[name][0] : params[name] ?? null
  if (!raw) return null

  const value = raw.trim()
  return value.length ? value : null
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

  const fieldDefaults: AdminFieldDefaults = {
    github: lookupGithub ?? '',
    shiftId: shiftId ?? '',
    publicId: publicId ?? ''
  }
  return <AdminPageContent fieldDefaults={fieldDefaults} snapshot={snapshot} />
}
