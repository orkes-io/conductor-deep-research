import { useEffect, useState } from "react";
import { api, type Config, type RunSummary } from "./api";
import { usePoll } from "./usePoll";
import RunForm from "./RunForm";
import RunList from "./RunList";
import RunDetail from "./RunDetail";

export default function App() {
  const [config, setConfig] = useState<Config>();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(() => location.hash.slice(1) || null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.config().then(setConfig).catch((e) => setError(e.message));
  }, []);

  const anyRunning = runs.some((r) => r.status === "RUNNING");
  const refresh = () => api.runs().then(setRuns).catch((e) => setError(e.message));
  usePoll(refresh, anyRunning ? 5000 : 15000);

  const select = (id: string) => {
    setSelected(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="app">
      <header>
        <h1>Deep research on Conductor</h1>
        <p>
          A team of research agents on {config ? config.models.map((m) => m.label).join(", ") : "several models"}.
          Each agent researches one area, and an agent on a different model checks every claim.
        </p>
      </header>
      {error && <div className="error">{error}</div>}
      <main>
        <aside>
          <RunForm
            config={config}
            onStarted={(id) => {
              select(id);
              refresh();
            }}
          />
          <RunList runs={runs} selected={selected} onSelect={select} />
        </aside>
        <section className="detail">
          {selected ? (
            <RunDetail key={selected} id={selected} />
          ) : (
            <div className="empty">Start a research run, or pick one from the list.</div>
          )}
        </section>
      </main>
    </div>
  );
}
