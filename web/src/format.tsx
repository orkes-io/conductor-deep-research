// Small display helpers shared by the views.
const toMs = (t?: string | number) => (t === undefined || t === null || t === "" ? undefined : typeof t === "number" ? t : Date.parse(t));

export function when(t?: string | number) {
  const ms = toMs(t);
  return ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

export function elapsed(start?: string | number, end?: string | number) {
  const a = toMs(start);
  if (!a) return "";
  const secs = Math.max(0, Math.round(((toMs(end) || Date.now()) - a) / 1000));
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`;
}

const LABELS: Record<string, string> = {
  RUNNING: "running",
  COMPLETED: "done",
  COMPLETED_WITH_ERRORS: "done with errors",
  FAILED: "failed",
  TERMINATED: "stopped",
  TIMED_OUT: "timed out",
  SCHEDULED: "waiting",
};

export function Status({ value }: { value: string }) {
  return <span className={`status s-${value.toLowerCase()}`}>{LABELS[value] ?? value.toLowerCase()}</span>;
}
