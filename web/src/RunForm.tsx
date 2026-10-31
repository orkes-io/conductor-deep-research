import { useState, type FormEvent } from "react";
import { api, type Config } from "./api";

export default function RunForm({ config, onStarted }: { config?: Config; onStarted: (id: string) => void }) {
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [numAreas, setNumAreas] = useState(4);
  const [minIterations, setMin] = useState(2);
  const [maxIterations, setMax] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { workflowId } = await api.start({ topic, goal, audience, numAreas, minIterations, maxIterations });
      onStarted(workflowId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>New research</h2>
      <label>
        Topic
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What should the team research?" required />
      </label>
      <label>
        Goal
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="What decision or question should the report answer?" />
      </label>
      <label>
        Audience <span className="hint">(optional)</span>
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who will read the report?" />
      </label>
      <div className="row">
        <label>
          Researchers
          <input type="number" min={1} max={config?.maxAreas ?? 30} value={numAreas} onChange={(e) => setNumAreas(Number(e.target.value))} />
        </label>
        <label>
          Min rounds
          <input type="number" min={1} max={6} value={minIterations} onChange={(e) => setMin(Number(e.target.value))} />
        </label>
        <label>
          Max rounds
          <input type="number" min={1} max={6} value={maxIterations} onChange={(e) => setMax(Number(e.target.value))} />
        </label>
      </div>
      <button disabled={busy || topic.trim().length < 3}>{busy ? "Starting..." : "Start research"}</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
