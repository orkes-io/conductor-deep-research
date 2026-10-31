// The deep_research_render_pdf worker. It turns the final markdown report into a PDF in reports/.
// GENERATE_PDF would do this on the server, but on Orkes Developer Edition it saves the file on the
// server's own disk, so the PDF is rendered here, next to the UI that serves it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import puppeteer, { type Browser } from "puppeteer";
import type { Task } from "@io-orkes/conductor-javascript";

export const REPORTS_DIR = join(import.meta.dirname, "..", "reports");
export const pdfPath = (workflowId: string) => join(REPORTS_DIR, `${workflowId}.pdf`);

const STYLE = `
  body { font: 10.5pt/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; }
  h1 { font-size: 20pt; margin: 0 0 10px; }
  h1:not(:first-child) { page-break-before: always; }
  h2 { font-size: 14pt; margin-top: 22px; border-bottom: 1px solid #d0d7de; padding-bottom: 4px; }
  h3 { font-size: 11.5pt; margin-top: 16px; }
  a { color: #0969da; text-decoration: none; word-break: break-word; }
  table { border-collapse: collapse; width: 100%; font-size: 8.5pt; margin: 10px 0; }
  th, td { border: 1px solid #d0d7de; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; }
  ol li, ul li { margin: 2px 0; }
  em { color: #57606a; }
`;

let browser: Promise<Browser> | undefined;

export async function renderPdf(markdown: string): Promise<Buffer> {
  browser ??= puppeteer.launch({ headless: true });
  const page = await (await browser).newPage();
  try {
    // The report contains text from the web, so the page runs no scripts and loads nothing.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (req) => (req.url().startsWith("data:") ? req.continue() : req.abort()));
    const html = await marked.parse(markdown);
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${html}`);
    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0.7in", bottom: "0.7in", left: "0.75in", right: "0.75in" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;width:100%;text-align:center;color:#888">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export const renderPdfWorker = {
  taskDefName: "deep_research_render_pdf",
  execute: async ({ inputData }: Task) => {
    const { workflowId, markdown } = inputData ?? {};
    if (typeof workflowId !== "string" || !/^[\w-]+$/.test(workflowId) || typeof markdown !== "string") {
      return { status: "FAILED" as const, reasonForIncompletion: "workflowId and markdown are required" };
    }
    const pdf = await renderPdf(markdown);
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(pdfPath(workflowId), pdf);
    return { status: "COMPLETED" as const, outputData: { file: `reports/${workflowId}.pdf`, sizeBytes: pdf.length } };
  },
};
