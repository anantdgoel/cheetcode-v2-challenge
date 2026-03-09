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

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const page = Math.max(0, parseInt(pageParam ?? '0', 10) || 0)

  const data = await getCandidates(page)
  return (
    <main className='admin-shell'>
      <AdminTableView data={data} />
    </main>
  )
}
