import { notFound } from 'next/navigation'
import { ReportCard } from '@/features/report/client/ReportCard'
import { ContactForm } from '@/features/report/client/ContactForm'
import { getContactSubmission, getReportView } from '@/features/report/server/queries'

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

  const contactCheck = await getContactSubmission(publicId)

  return (
    <main className='report-shell'>
      <ReportCard publicId={publicId} report={report} />
      <ContactForm
        github={report.github}
        reportPublicId={publicId}
        alreadySubmitted={!!contactCheck}
      />
    </main>
  )
}
