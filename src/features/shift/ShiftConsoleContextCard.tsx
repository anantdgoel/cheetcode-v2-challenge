import Link from "next/link";
import type { ProbeSummary } from "@/lib/domain/game";
import type { ShiftView } from "@/lib/domain/views";
import { formatPercent, formatTitle } from "@/lib/engine/report";
import { getTitlePresentation } from "@/lib/frontend/title-display";
import { conditionDotClass, formatIncidents } from "./shift-console-state";

export function ShiftConsoleContextCard(props: {
  activeProbeSummary?: ProbeSummary;
  shift: ShiftView;
}) {
  if (props.shift.finalEvaluation?.metrics) {
    const title = props.shift.finalEvaluation.title ?? "off_the_board";
    const { line } = getTitlePresentation(title);

    return (
      <div className="console-context-card console-context-card--final">
        <p className="console-final__eyebrow">Final Evaluation</p>
        <div className="console-final__classification">
          <span className="console-metric-label">Classification</span>
          <h2 className="console-final__title">{formatTitle(title)}</h2>
          <div className="console-final__badges">
            {line !== "—" && <span className="console-final__line-badge">Line {line}</span>}
            <span className="console-final__board-certified">Board Certified</span>
          </div>
        </div>
        <hr className="console-divider" />
        <div>
          <span className="console-metric-label">Board Efficiency</span>
          <p className="console-metric-value console-metric-value--huge">
            {formatPercent(props.shift.finalEvaluation.metrics.efficiency)}
          </p>
        </div>
        <div className="console-final__calls">
          {[
            {
              label: "Connected",
              value: `${props.shift.finalEvaluation.metrics.connectedCalls} / ${props.shift.finalEvaluation.metrics.totalCalls}`,
            },
            {
              danger: true,
              label: "Dropped",
              value: String(props.shift.finalEvaluation.metrics.droppedCalls),
            },
          ].map((metric) => (
            <div key={metric.label} className="console-final__call-metric">
              <span className="console-metric-label">{metric.label}</span>
              <span className={`console-metric-value${metric.danger ? " console-metric-value--danger" : ""}`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
        <hr className="console-divider" />
        {props.shift.reportPublicId && (
          <Link href={`/report/${props.shift.reportPublicId}`} className="console-final__report-link">
            View Shift Report <span>&rarr;</span>
          </Link>
        )}
      </div>
    );
  }

  if (props.activeProbeSummary) {
    return (
      <div className="console-context-card">
        <p className="console-card-eyebrow">Trial Shift Results</p>
        <div className="console-trial__condition">
          <span className={conditionDotClass(props.activeProbeSummary.deskCondition)} />
          <span className="console-trial__condition-label">
            {props.activeProbeSummary.deskCondition.charAt(0).toUpperCase() + props.activeProbeSummary.deskCondition.slice(1)}
          </span>
        </div>
        {[
          [
            { label: "Efficiency", large: true, value: formatPercent(props.activeProbeSummary.metrics.efficiency) },
            {
              label: "Connected",
              value: `${props.activeProbeSummary.metrics.connectedCalls} / ${props.activeProbeSummary.metrics.totalCalls}`,
            },
          ],
          [
            {
              danger: true,
              label: "Dropped",
              value: String(props.activeProbeSummary.metrics.droppedCalls),
            },
            {
              label: "Avg Hold",
              value: `${props.activeProbeSummary.metrics.avgHoldSeconds.toFixed(1)}s`,
            },
          ],
        ].map((row, rowIndex) => (
          <div key={rowIndex} className="console-trial__metrics">
            {row.map((metric) => (
              <div key={metric.label} className="console-trial__metric">
                <span className="console-metric-label">{metric.label}</span>
                <span className={`console-metric-value${metric.large ? " console-metric-value--large" : ""}${metric.danger ? " console-metric-value--danger" : ""}`}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        ))}
        <hr className="console-divider" />
        <div className="console-trial__log">
          <span className="console-metric-label">Failure Log</span>
          <p className="console-trial__log-text">
            {props.activeProbeSummary.incidents.length > 0
              ? formatIncidents(props.activeProbeSummary.incidents.slice(0, 8))
              : "No incidents recorded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="console-context-card">
      <p className="console-card-eyebrow">Supervisor Console</p>
      <p className="console-supervisor__empty">
        No trial dispatched yet.{"\n"}Study the dossier. Write your policy. Validate when ready.
      </p>
    </div>
  );
}
