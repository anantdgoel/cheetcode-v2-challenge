import { notFound } from "next/navigation";
import { ReportCard } from "@/components/report/ReportCard";
import { getReportView } from "@/lib/app/shift-service";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const report = await getReportView(publicId);

  if (!report) {
    notFound();
  }
  return <ReportCard publicId={publicId} report={report} />;
}
