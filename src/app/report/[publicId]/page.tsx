import { notFound } from 'next/navigation'
import { ReportCard } from '@/features/report/client/ReportCard'
import { ContactForm } from '@/features/report/client/ContactForm'
import { getContactSubmission, getReportView } from '@/features/report/server/queries'
import { getGithubUsername } from '@/server/auth/github'

export const dynamic = 'force-dynamic'

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

  return (
    <main className='report-shell'>
      <ReportCard publicId={publicId} report={report} />
      {showContactForm && (
        <ContactForm
          github={report.github}
          reportPublicId={publicId}
          alreadySubmitted={!!contactCheck}
        />
      )}
    </main>
  )
}
