import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ConvexAuthProvider } from '@/features/landing/client/ConvexAuthProvider'
import { ReportCard } from '@/features/report/client/ReportCard'
import { ContactForm } from '@/features/report/client/ContactForm'
import { getContactSubmission, getReportView } from '@/features/report/server/queries'
import { getGithubUsername } from '@/server/auth/github'

export const dynamic = 'force-dynamic'

export async function generateMetadata ({
  params
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params
  const report = await getReportView(publicId)
  if (!report) return { title: 'Shift Report — Firecrawl Exchange' }
  return {
    title: `${report.github} — Shift Report`,
    description: `${report.title} · Board Efficiency ${Math.round(report.boardEfficiency * 100)}%`
  }
}

export default async function ReportPage ({
  params
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params
  const report = await getReportView(publicId)

  if (!report) {
    notFound()
  }

  const github = await getGithubUsername()
  const showContactForm =
    report.hiddenScore > 0.75 && github != null && github === report.github

  const contactCheck = showContactForm
    ? await getContactSubmission(publicId)
    : null

  const { hiddenScore: _, ...clientReport } = report

  return (
    <main className='report-shell'>
      <ReportCard publicId={publicId} report={clientReport} />
      {showContactForm && (
        <ConvexAuthProvider>
          <ContactForm
            reportPublicId={publicId}
            alreadySubmitted={!!contactCheck}
          />
        </ConvexAuthProvider>
      )}
    </main>
  )
}
