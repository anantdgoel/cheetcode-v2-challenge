import { redirect } from 'next/navigation'
import { AdminTableView } from '@/features/admin/client/AdminTableView'
import { AdminDetailView } from '@/features/admin/client/AdminDetailView'
import { getCandidates, getCandidateDetail } from '@/features/admin/server/queries'
import { getGithubUsername, isAdminGithub } from '@/server/auth/github'

export const dynamic = 'force-dynamic'

export default async function AdminPage ({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [github, params] = await Promise.all([getGithubUsername(), searchParams])
  if (!isAdminGithub(github)) {
    redirect('/')
  }

  const candidateParam = Array.isArray(params.candidate) ? params.candidate[0] : params.candidate
  const candidate = candidateParam?.trim() || null

  if (candidate) {
    const detail = await getCandidateDetail(candidate)
    return (
      <main className='admin-shell'>
        <AdminDetailView detail={detail} />
      </main>
    )
  }

  const cursorParam = Array.isArray(params.cursor) ? params.cursor[0] : params.cursor
  const cursor = cursorParam?.trim() || null

  const startParam = Array.isArray(params.start) ? params.start[0] : params.start
  const startRank = Math.max(0, parseInt(startParam ?? '0', 10) || 0)

  const data = await getCandidates(cursor, startRank)
  return (
    <main className='admin-shell'>
      <AdminTableView data={data} />
    </main>
  )
}
