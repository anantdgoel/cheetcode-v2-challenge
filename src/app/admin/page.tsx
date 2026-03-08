import { redirect } from "next/navigation";
import { getAdminSnapshot } from "@/lib/app/shift-service";
import { formatPercent, formatTitle } from "@/lib/engine/report";
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

  const snapshot = await getAdminSnapshot({
    github: lookupGithub,
    shiftId,
    publicId,
  });

  const fieldDefaults: Record<string, string> = {
    github: lookupGithub ?? "",
    shiftId: shiftId ?? "",
    publicId: publicId ?? "",
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
                <h2>{snapshot.shift.id.slice(-8).toUpperCase()}</h2>
                <p>Status: {snapshot.shift.state}</p>
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
          {snapshot.runs.length ? (
            snapshot.runs.map((evaluation) => (
              <article key={evaluation.id} className="admin-evaluation-card">
                <h3>
                  {evaluation.kind} · {evaluation.state}
                </h3>
                <p>{evaluation.id}</p>
                <p>Accepted: {new Date(evaluation.acceptedAt).toLocaleString()}</p>
              </article>
            ))
          ) : (
            <p className="empty-state">No evaluations available for the selected lookup.</p>
          )}
        </section>
      </section>
    </main>
  );
}
