import { notFound } from 'next/navigation'
import { ReportCard } from '@/features/report/client/ReportCard'
import { getReportView } from '@/features/report/server/queries'

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
  return <ReportCard publicId={publicId} report={report} />
}
