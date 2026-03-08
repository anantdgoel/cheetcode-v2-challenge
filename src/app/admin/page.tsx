import { redirect } from "next/navigation";
import { formatPercent, formatTitle } from "@/lib/exchange";
import { getAdminSnapshot } from "@/lib/shift-service";
import { getGithubUsername, isAdminGithub } from "@/lib/server-auth";
import { normalizeSearchParam } from "@/lib/validation";

export const dynamic = "force-dynamic";

function parseParam(params: Record<string, string | string[] | undefined>, name: string) {
  return normalizeSearchParam(
    Array.isArray(params[name]) ? params[name][0] : params[name] ?? null,
  );
}

const FIELDS = [
  { name: "github", placeholder: "GitHub login" },
  { name: "shiftId", placeholder: "Shift id" },
  { name: "publicId", placeholder: "Report public id" },
  { name: "evaluationId", placeholder: "Evaluation id" },
  { name: "tracePage", placeholder: "Trace page" },
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const github = await getGithubUsername();
  if (!isAdminGithub(github)) {
    redirect("/");
  }

  const params = await searchParams;
  const lookupGithub = parseParam(params, "github");
  const shiftId = parseParam(params, "shiftId");
  const publicId = parseParam(params, "publicId");
  const evaluationId = parseParam(params, "evaluationId");
  const tracePageRaw = Array.isArray(params.tracePage)
    ? params.tracePage[0]
    : (params.tracePage ?? "0");
  const tracePage = Math.max(0, parseInt(tracePageRaw, 10) || 0);

  const snapshot = await getAdminSnapshot({
    github: lookupGithub,
    shiftId,
    publicId,
    evaluationId,
    tracePage,
  });

  const fieldDefaults: Record<string, string> = {
    github: lookupGithub ?? "",
    shiftId: shiftId ?? "",
    publicId: publicId ?? "",
    evaluationId: evaluationId ?? "",
    tracePage: String(tracePage || 0),
  };

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Internal Operations</p>
            <h1>Shift Lookup</h1>
          </div>
        </div>

        <form className="admin-form" action="/admin">
          {FIELDS.map(({ name, placeholder }) => (
            <input
              key={name}
              className="admin-input"
              name={name}
              placeholder={placeholder}
              defaultValue={fieldDefaults[name]}
            />
          ))}
          <button className="madison-button" type="submit">
            Inspect
          </button>
        </form>

        <div className="admin-grid">
          <article className="rule-card">
            <p className="eyebrow">Shift</p>
            {snapshot.shift ? (
              <>
                <h2>{String(snapshot.shift._id).slice(-8).toUpperCase()}</h2>
                <p>Status: {snapshot.shift.status}</p>
                <p>Owner: {snapshot.shift.github}</p>
                <p>Expires: {new Date(snapshot.shift.expiresAt).toLocaleString()}</p>
              </>
            ) : (
              <p>No matching shift.</p>
            )}
          </article>

          <article className="rule-card">
            <p className="eyebrow">Leaderboard</p>
            {snapshot.leaderboardRow ? (
              <>
                <h2>{snapshot.leaderboardRow.github}</h2>
                <p>{formatTitle(snapshot.leaderboardRow.title)}</p>
                <p>{formatPercent(snapshot.leaderboardRow.boardEfficiency)}</p>
              </>
            ) : (
              <p>No leaderboard row for this lookup.</p>
            )}
          </article>

          <article className="rule-card">
            <p className="eyebrow">Report</p>
            {snapshot.report ? (
              <>
                <h2>{snapshot.report.publicId}</h2>
                <p>{formatTitle(snapshot.report.title)}</p>
                <p>{formatPercent(snapshot.report.boardEfficiency)}</p>
              </>
            ) : (
              <p>No public report matched.</p>
            )}
          </article>
        </div>

        <section className="admin-evaluations">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Evaluations</p>
              <h2>Accepted Runs</h2>
            </div>
          </div>
          {snapshot.evaluations.length ? (
            snapshot.evaluations.map((evaluation) => (
              <article key={String(evaluation._id)} className="admin-evaluation-card">
                <h3>
                  {evaluation.kind} · {evaluation.state}
                </h3>
                <p>{String(evaluation._id)}</p>
                <p>Accepted: {new Date(evaluation.acceptedAt).toLocaleString()}</p>
              </article>
            ))
          ) : (
            <p className="empty-state">No evaluations available for the selected lookup.</p>
          )}
        </section>

        <section className="admin-trace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trace</p>
              <h2>Paginated Event Chunks</h2>
            </div>
          </div>
          {snapshot.trace?.chunk ? (
            <>
              <p>
                Evaluation {String(snapshot.trace.evaluationId)} · page {snapshot.trace.page + 1} of{" "}
                {snapshot.trace.totalPages}
              </p>
              <pre className="artifact-panel__content">{snapshot.trace.chunk.payload}</pre>
            </>
          ) : (
            <p className="empty-state">Choose a shift or evaluation to inspect stored trace chunks.</p>
          )}
        </section>
      </section>
    </main>
  );
}
