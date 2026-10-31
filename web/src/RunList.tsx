import type { RunSummary } from "./api";
import { Status, elapsed, when } from "./format";

export default function RunList({ runs, selected, onSelect }: { runs: RunSummary[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="card runs">
      <h2>Research runs</h2>
      {runs.length === 0 && <p className="hint">No runs yet.</p>}
      <ul>
        {runs.map((r) => (
          <li key={r.workflowId} className={r.workflowId === selected ? "selected" : ""} onClick={() => onSelect(r.workflowId)}>
            <div className="topic">{r.topic || r.workflowId}</div>
            <div className="meta">
              <Status value={r.status} /> <span>{r.numAreas} researchers</span>
              <span>{when(r.startTime)}</span>
              <span>{elapsed(r.startTime, r.endTime)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
