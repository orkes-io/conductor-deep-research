import { useState } from "react";
import { api, type Area, type AreaDetail, type RunDetail as Run } from "./api";
import { usePoll } from "./usePoll";
import { Status, elapsed, when } from "./format";

export default function RunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Area | null>(null);

  const running = !run || run.status === "RUNNING";
  usePoll(() => api.run(id).then(setRun).catch((e) => setError(e.message)), 4000, running);

  if (error) return <div className="error">{error}</div>;
  if (!run) return <div className="empty">Loading...</div>;

  const finished = run.areas.filter((a) => a.status !== "RUNNING" && a.status !== "SCHEDULED").length;
  const sum = (k: "supported" | "disputed" | "refuted") => run.areas.reduce((n, a) => n + (a.progress?.[k] ?? 0), 0);

  return (
    <div className="card run">
      <div className="run-head">
        <div>
          <h2>{run.topic}</h2>
          <p className="goal">{run.goal}</p>
          <p className="meta">
            <Status value={run.status} /> <span>{run.status === "RUNNING" ? run.phase : ""}</span>
            <span>started {when(run.startTime)}</span>
            <span>{elapsed(run.startTime, run.endTime)}</span>
          </p>
          {run.reason && <p className="error">{run.reason}</p>}
        </div>
        <div className="actions">
          <a className="button secondary" href={run.url} target="_blank" rel="noreferrer">Open in Conductor</a>
          {run.hasReport && <a className="button" href={`/api/runs/${id}/pdf`}>Download PDF</a>}
          {run.hasReport && <a className="button secondary" href={`/api/runs/${id}/report.md`}>Markdown</a>}
          {run.status === "RUNNING" && (
            <button className="danger" onClick={() => api.terminate(id).then(() => api.run(id).then(setRun))}>Stop</button>
          )}
        </div>
      </div>

      <div className="totals">
        <div><b>{finished}</b> of {run.areas.length || run.numAreas} researchers finished</div>
        <div className="ok"><b>{sum("supported")}</b> supported</div>
        <div className="warn"><b>{sum("disputed")}</b> disputed</div>
        <div className="bad"><b>{sum("refuted")}</b> refuted</div>
      </div>

      {run.areas.length === 0 ? (
        <p className="hint">The planner is splitting the goal into research areas...</p>
      ) : (
        <table className="areas">
          <thead>
            <tr>
              <th>#</th>
              <th>Area</th>
              <th>Researcher / reviewer</th>
              <th>Round</th>
              <th>Claims</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {run.areas.map((a) => (
              <tr key={a.areaIndex} onClick={() => a.childId && setOpen(a)} className={a.childId ? "clickable" : ""}>
                <td>{a.areaIndex + 1}</td>
                <td>{a.title}</td>
                <td>
                  {a.researcher} <span className="hint">checked by</span> {a.reviewer}
                </td>
                <td>
                  <Rounds p={a.progress} />
                </td>
                <td className="counts">
                  <span className="ok">{a.progress?.supported ?? 0}</span> /{" "}
                  <span className="warn">{a.progress?.disputed ?? 0}</span> /{" "}
                  <span className="bad">{a.progress?.refuted ?? 0}</span>
                </td>
                <td>
                  <Status value={a.status} /> {a.progress?.status && a.status === "COMPLETED" ? <span className="hint">{a.progress.status}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {run.missing?.length > 0 && <p className="error">Didn't complete: {run.missing.map((m) => m.title).join("; ")}</p>}
      {open && <ClaimsDrawer runId={id} area={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Rounds({ p }: { p: Area["progress"] }) {
  if (!p) return <span className="hint">-</span>;
  const pct = Math.min(100, Math.round((p.round / Math.max(1, p.maxRounds)) * 100));
  return (
    <div className="rounds">
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      <span>{p.round} of {p.maxRounds}</span>
    </div>
  );
}

function ClaimsDrawer({ runId, area, onClose }: { runId: string; area: Area; onClose: () => void }) {
  const [detail, setDetail] = useState<AreaDetail>();
  usePoll(() => api.area(runId, area.childId!).then(setDetail), 5000, area.status === "RUNNING");

  return (
    <div className="drawer" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">x</button>
        <h3>{area.title}</h3>
        <p className="hint">
          {area.researcher} researches, {area.reviewer} checks.{" "}
          {area.url && <a href={area.url} target="_blank" rel="noreferrer">Open this researcher's workflow</a>}
        </p>
        {!detail && <p>Loading...</p>}
        {detail?.ledger?.claims.map((c) => (
          <div key={c.id} className={`claim c-${c.status}`}>
            <div className="claim-head"><b>{c.id}</b> <span className="verdict">{c.status}</span>{c.revisions ? <span className="hint"> revised</span> : null}</div>
            <div>{c.claim}</div>
            {c.lastReason && <div className="reason">Reviewer: {c.lastReason}</div>}
            <div className="sources">
              {c.sources.map((s) => (
                <a key={s} href={s} target="_blank" rel="noreferrer">{new URL(s).hostname}</a>
              ))}
            </div>
          </div>
        ))}
        {detail?.ledger?.refuted?.length ? <h4>Refuted and removed</h4> : null}
        {detail?.ledger?.refuted?.map((r) => (
          <div key={r.id + r.round} className="claim c-refuted">
            <div className="claim-head"><b>{r.id}</b> <span className="verdict">refuted in round {r.round}</span></div>
            <div>{r.claim}</div>
            <div className="reason">Reviewer: {r.reason}</div>
          </div>
        ))}
        {detail?.feedback?.gaps?.length ? (
          <>
            <h4>Open gaps</h4>
            <ul>{detail.feedback.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
