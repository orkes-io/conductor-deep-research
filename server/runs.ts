// Reads deep_research runs and their research_area children from Conductor for the UI.
import { existsSync } from "node:fs";
import type { Task, Workflow } from "@io-orkes/conductor-javascript";
import { workflows, uiBase } from "./conductor.ts";
import { pdfPath } from "./pdf.ts";

const TERMINAL = new Set(["COMPLETED", "FAILED", "TIMED_OUT", "TERMINATED"]);
export const isRunId = (id: string) => /^[\w-]{8,64}$/.test(id);

// Search results carry the input as a Java toString, so each run's topic is read once and cached.
const runMeta = new Map<string, { topic: string; goal: string; numAreas: number }>();

export async function listRuns() {
  const res = await workflows.search(0, 25, "workflowType IN (deep_research)", "*", "startTime:DESC");
  return Promise.all(
    (res.results ?? []).map(async (r) => {
      const id = r.workflowId!;
      if (!runMeta.has(id)) {
        const input: any = (await workflows.getWorkflow(id, false)).input ?? {};
        runMeta.set(id, { topic: input.topic ?? "", goal: input.goal ?? "", numAreas: input.numAreas ?? 0 });
      }
      return { workflowId: id, status: r.status, startTime: r.startTime, endTime: r.endTime, ...runMeta.get(id) };
    }),
  );
}

// Child progress lives in each research_area's `progress` variable. Finished children never change,
// so they're cached for good; running ones for a few seconds.
const childCache = new Map<string, { at: number; status: string; progress: any }>();

async function childProgress(childId: string) {
  const hit = childCache.get(childId);
  if (hit && (TERMINAL.has(hit.status) || Date.now() - hit.at < 4000)) return hit;
  const s = await workflows.getWorkflowStatus(childId, false, true);
  const entry = { at: Date.now(), status: String(s.status), progress: s.variables?.progress ?? null };
  childCache.set(childId, entry);
  return entry;
}

function phaseOf(w: Workflow, task: (ref: string) => Task | undefined) {
  if (TERMINAL.has(String(w.status))) return String(w.status).toLowerCase();
  if (task("plan_areas")?.status !== "COMPLETED") return "planning";
  if (!task("research_join")?.status?.startsWith("COMPLETED")) return "researching";
  if (!task("write_synthesis")?.status?.startsWith("COMPLETED")) return "writing the report";
  return "rendering the PDF";
}

export async function runDetail(id: string) {
  const w = await workflows.getWorkflow(id, true);
  if (w.workflowName !== "deep_research") return null;
  const tasks = w.tasks ?? [];
  const task = (ref: string) => tasks.find((t) => t.referenceTaskName === ref);
  const fanout: any = task("prepare_fanout")?.outputData ?? {};
  const plan: any[] = fanout.result?.plan ?? [];

  // FORK_JOIN_DYNAMIC names its children _research_fanout_0, _1, ... Match them on areaIndex.
  const areaIndexOf = (t: Task) => (t.inputData as any)?.workflowInput?.areaIndex ?? (t.inputData as any)?.areaIndex;
  const forked = tasks.filter((t) => t.taskType === "SUB_WORKFLOW" && areaIndexOf(t) !== undefined);
  const areas = await Promise.all(
    plan.map(async (p) => {
      const t = forked.find((f) => areaIndexOf(f) === p.areaIndex);
      const childId = (t?.subWorkflowId ?? (t?.outputData as any)?.subWorkflowId) as string | undefined;
      const child = childId ? await childProgress(childId) : null;
      return {
        ...p,
        childId,
        status: child?.status ?? t?.status ?? "SCHEDULED",
        progress: child?.progress ?? null,
        url: childId ? `${uiBase}/execution/${childId}` : null,
      };
    }),
  );

  return {
    workflowId: id,
    status: w.status,
    phase: phaseOf(w, task),
    topic: w.input?.topic,
    goal: w.input?.goal,
    numAreas: w.input?.numAreas,
    startTime: w.startTime,
    endTime: w.endTime,
    reason: w.reasonForIncompletion,
    url: `${uiBase}/execution/${id}`,
    areas,
    totals: w.output?.totals ?? null,
    missing: w.output?.missing ?? [],
    hasReport: typeof w.output?.markdown === "string",
    pdfReady: existsSync(pdfPath(id)),
  };
}

export async function areaDetail(runId: string, childId: string) {
  const c = await workflows.getWorkflow(childId, false);
  if (c.parentWorkflowId !== runId) return null;
  return {
    status: c.status,
    progress: c.variables?.progress ?? null,
    ledger: c.variables?.ledger ?? null,
    feedback: c.variables?.feedback ?? null,
    report: c.output?.report ?? null,
  };
}

export async function reportMarkdown(id: string): Promise<string | null> {
  const w = await workflows.getWorkflow(id, false);
  if (w.workflowName !== "deep_research") return null;
  return typeof w.output?.markdown === "string" ? w.output.markdown : null;
}
