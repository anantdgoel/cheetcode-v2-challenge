import { notFound } from "next/navigation";
import { getReportView } from "@/lib/app/shift-service";
import { formatPercent, formatTitle } from "@/lib/engine/report";
import type { Title } from "@/lib/contracts/game";

export const dynamic = "force-dynamic";

function getTitleMeta(title: Title) {
  const lineMap: Record<Title, string> = {
    chief_operator: "01",
    senior_operator: "02",
    operator: "03",
    trainee: "04",
    off_the_board: "—",
  };
  const isTop = title === "chief_operator";
  const barClass = isTop
    ? "report-card__bar-fill--gold"
    : title === "off_the_board"
      ? "report-card__bar-fill--muted"
      : "report-card__bar-fill--accent";
  return { line: lineMap[title], isTop, barClass, tone: isTop ? "amber" : "neutral" as const };
}

function formatDate(timestamp: number) {
  const d = new Date(timestamp);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const METRICS = [
  { label: "Connected", key: "connected" },
  { label: "Dropped", key: "dropped" },
  { label: "Avg Hold", key: "hold" },
  { label: "Premium Trunk", key: "premium" },
] as const;

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

  const { line, barClass, tone } = getTitleMeta(report.title);
  const effPct = (report.boardEfficiency * 100).toFixed(1);
  const shiftRef = String(report.shiftId).slice(-6).toUpperCase();

  const metricValues: Record<string, { value: string; modifier?: string }> = {
    connected: { value: `${report.connectedCalls} / ${report.totalCalls}` },
    dropped: { value: String(report.droppedCalls), modifier: "report-card__metric-value--danger" },
    hold: { value: `${report.avgHoldSeconds.toFixed(1)}s` },
    premium: { value: `${report.premiumTrunkUsage} uses`, modifier: "report-card__metric-value--gold" },
  };

  return (
    <main className="report-shell">
      <section className="report-card">
        {/* ── Letterhead ── */}
        <div className="report-card__letterhead">
          <div>
            <div className="report-card__letterhead-brand">Firecrawl</div>
            <div className="report-card__letterhead-sub">
              Exchange Supervisory Division
            </div>
          </div>
          <div className="report-card__letterhead-form">
            Form SR-63
            <span>Supervisor&apos;s Shift Report</span>
          </div>
        </div>

        {/* ── Operator identity + Classification badge ── */}
        <div className="report-card__identity-block">
          <div className="report-card__callsign-area">
            <p className="report-card__eyebrow">Operator on Record</p>
            <h1 className="report-card__callsign">{report.github}</h1>
            <div className="report-card__pills">
              <span className={`report-card__pill report-card__pill--line report-card__pill--${tone}`}>
                Line {line}
              </span>
              <span className="report-card__pill report-card__pill--neutral">
                Shift #{shiftRef}
              </span>
            </div>
          </div>

          <div className={`report-card__badge report-card__badge--${tone}`}>
            <span className="report-card__badge-label">Classification</span>
            <h2 className="report-card__badge-title">{formatTitle(report.title)}</h2>
            <div className="report-card__badge-insignia">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`report-card__badge-stripe report-card__badge-stripe--${tone}`} />
              ))}
            </div>
            <span className={`report-card__badge-certified report-card__badge-certified--${tone}`}>
              Board Certified
            </span>
          </div>
        </div>

        {/* ── Board Efficiency ── */}
        <div className="report-card__efficiency">
          <div className="report-card__efficiency-left">
            <p className="report-card__eyebrow">Board Efficiency</p>
            <p className="report-card__efficiency-value">
              {formatPercent(report.boardEfficiency)}
            </p>
            <p className="report-card__eyebrow" style={{ marginTop: 2 }}>
              Calls Connected / Attempted
            </p>
          </div>
          <div className="report-card__efficiency-right">
            <span className="report-card__efficiency-label report-card__calls-label">
              {report.connectedCalls} of {report.totalCalls} Calls
            </span>
            <div className="report-card__bar-track">
              <div
                className={`report-card__bar-fill ${barClass}`}
                style={{ width: `${effPct}%` }}
              />
            </div>
            <span className="report-card__efficiency-label report-card__dropped-label">
              {report.droppedCalls} Dropped
            </span>
          </div>
        </div>

        {/* ── Metrics row ── */}
        <div className="report-card__metrics-row">
          {METRICS.map(({ label, key }) => {
            const { value, modifier } = metricValues[key];
            return (
              <div key={key} className="report-card__metric">
                <span className="report-card__metric-label">{label}</span>
                <span className={`report-card__metric-value${modifier ? ` ${modifier}` : ""}`}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Supervisor's Note ── */}
        <div className="report-card__note">
          <div className="report-card__note-header">
            <p className="report-card__eyebrow">Supervisor&apos;s Note</p>
            <span className="report-card__note-date">{formatDate(report.achievedAt)}</span>
          </div>
          <div className="report-card__note-rule" />
          <p className="report-card__note-body">{report.chiefOperatorNote}</p>
          <div className="report-card__signature">
            <div className="report-card__signature-line" />
            <span className="report-card__signature-label">
              Supervisor, Firecrawl Exchange
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="report-card__footer">
          <div className="report-card__dots">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="report-card__dot" />
            ))}
          </div>
          <span>
            Firecrawl Exchange &middot; Supervisory Division &middot; Confidential
          </span>
          <span>Ref: {publicId.slice(0, 6)}</span>
        </div>
      </section>
    </main>
  );
}
