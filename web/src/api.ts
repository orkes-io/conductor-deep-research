// Typed calls to the UI server. The browser never talks to Conductor directly.
export interface Config {
  models: { label: string; kind: string }[];
  conductorUi: string;
  maxAreas: number;
}

export interface RunSummary {
  workflowId: string;
  status: string;
  startTime?: string | number;
  endTime?: string | number;
  topic: string;
  goal: string;
  numAreas: number;
}

export interface Progress {
  round: number;
  maxRounds: number;
  supported: number;
  disputed: number;
  refuted: number;
  unverifiable: number;
  phase: string;
  outcome: string;
  status?: string;
}

export interface Area {
  areaIndex: number;
  title: string;
  researcher: string;
  reviewer: string;
  childId?: string;
  status: string;
  progress: Progress | null;
  url: string | null;
}

export interface RunDetail {
  workflowId: string;
  status: string;
  phase: string;
  topic: string;
  goal: string;
  numAreas: number;
  startTime?: number;
  endTime?: number;
  reason?: string;
  url: string;
  areas: Area[];
  missing: { title: string; reason: string }[];
  hasReport: boolean;
  pdfReady: boolean;
}

export interface Claim {
  id: string;
  claim: string;
  evidence?: string;
  sources: string[];
  status: string;
  lastReason?: string;
  round?: number;
  revisions?: number;
}

export interface AreaDetail {
  status: string;
  progress: Progress | null;
  ledger: { claims: Claim[]; refuted: { id: string; claim: string; reason: string; round: number }[] } | null;
  feedback: { gaps: string[]; critique: string } | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

export const api = {
  config: () => fetch("/api/config").then(json<Config>),
  runs: () => fetch("/api/runs").then(json<RunSummary[]>),
  run: (id: string) => fetch(`/api/runs/${id}`).then(json<RunDetail>),
  area: (id: string, childId: string) => fetch(`/api/runs/${id}/areas/${childId}`).then(json<AreaDetail>),
  start: (body: Record<string, unknown>) =>
    fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(json<{ workflowId: string }>),
  terminate: (id: string) => fetch(`/api/runs/${id}/terminate`, { method: "POST" }).then(json),
};
