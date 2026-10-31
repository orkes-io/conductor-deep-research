// The UI server: a small JSON API over Conductor, the PDF worker, and the React app.
// Your Conductor key and secret stay here; the browser only talks to this server.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { TaskManager } from "@io-orkes/conductor-javascript";
import { clients, workflows, models, uiBase } from "./conductor.ts";
import { pdfPath, renderPdf, renderPdfWorker, REPORTS_DIR } from "./pdf.ts";
import { areaDetail, isRunId, listRuns, reportMarkdown, runDetail } from "./runs.ts";

const PORT = Number(process.env.PORT ?? 5173);
const app = express();
app.use(express.json({ limit: "20kb" }));

app.get("/api/config", (_req, res) => {
  res.json({ models: models.map(({ label, kind }) => ({ label, kind })), conductorUi: uiBase, maxAreas: 30 });
});

app.post("/api/runs", async (req, res) => {
  const { topic, goal, audience, numAreas, minIterations, maxIterations } = req.body ?? {};
  if (typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({ error: "A topic is required." });
  }
  const workflowId = await workflows.startWorkflow({
    name: "deep_research",
    version: 1,
    input: {
      topic: topic.trim(),
      goal: typeof goal === "string" && goal.trim() ? goal.trim() : topic.trim(),
      audience: typeof audience === "string" && audience.trim() ? audience.trim() : undefined,
      numAreas: Number(numAreas) || 4,
      minIterations: Number(minIterations) || 2,
      maxIterations: Number(maxIterations) || 3,
      models,
      requestedAt: new Date().toISOString(),
    },
  });
  res.json({ workflowId });
});

app.get("/api/runs", async (_req, res) => {
  res.json(await listRuns());
});

app.get("/api/runs/:id", async (req, res) => {
  if (!isRunId(req.params.id)) return res.status(400).json({ error: "Bad run id." });
  const run = await runDetail(req.params.id);
  return run ? res.json(run) : res.status(404).json({ error: "Not a deep_research run." });
});

app.get("/api/runs/:id/areas/:childId", async (req, res) => {
  const { id, childId } = req.params;
  if (!isRunId(id) || !isRunId(childId)) return res.status(400).json({ error: "Bad id." });
  const area = await areaDetail(id, childId);
  return area ? res.json(area) : res.status(404).json({ error: "That researcher isn't part of this run." });
});

app.get("/api/runs/:id/report.md", async (req, res) => {
  if (!isRunId(req.params.id)) return res.status(400).json({ error: "Bad run id." });
  const md = await reportMarkdown(req.params.id);
  if (!md) return res.status(404).json({ error: "The report isn't ready yet." });
  res.attachment(`deep-research-${req.params.id}.md`).type("text/markdown").send(md);
});

app.get("/api/runs/:id/pdf", async (req, res) => {
  const { id } = req.params;
  if (!isRunId(id)) return res.status(400).json({ error: "Bad run id." });
  if (!existsSync(pdfPath(id))) {
    // The worker normally writes the PDF. If it wasn't running then, render it now from the report.
    const md = await reportMarkdown(id);
    if (!md) return res.status(404).json({ error: "The report isn't ready yet." });
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(pdfPath(id), await renderPdf(md));
  }
  res.attachment(`deep-research-${id}.pdf`).type("application/pdf").send(readFileSync(pdfPath(id)));
});

app.post("/api/runs/:id/terminate", async (req, res) => {
  if (!isRunId(req.params.id)) return res.status(400).json({ error: "Bad run id." });
  await workflows.terminate(req.params.id, "Stopped from the deep research UI");
  res.json({ ok: true });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// The React app: Vite's dev server in development, the built files in production.
const webRoot = join(import.meta.dirname, "..", "web");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(join(webRoot, "dist")));
  app.get("/{*any}", (_req, res) => res.sendFile(join(webRoot, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

// Poll for deep_research_render_pdf tasks, so finished runs get their PDF.
new TaskManager(clients.getClient(), [renderPdfWorker], { options: { concurrency: 2, pollInterval: 1000 } }).startPolling();

app.listen(PORT, "127.0.0.1", () => console.log(`Deep research UI on http://localhost:${PORT}`));
