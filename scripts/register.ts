// Registers the task definitions and the three workflows from conductor/dist on your Conductor server.
// Reads CONDUCTOR_SERVER_URL, CONDUCTOR_AUTH_KEY and CONDUCTOR_AUTH_SECRET from .env.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OrkesClients } from "@io-orkes/conductor-javascript";

const DIST = join(import.meta.dirname, "..", "conductor", "dist");
const load = (file: string) => JSON.parse(readFileSync(join(DIST, file), "utf8"));

const clients = await OrkesClients.from();
const metadata = clients.getMetadataClient();

await metadata.registerTasks([
  load("taskdef.deep_research_llm.json"),
  load("taskdef.deep_research_render_pdf.json"),
]);
console.log("registered task definitions deep_research_llm, deep_research_render_pdf");

// Children first, so each parent references a workflow that already exists.
for (const name of ["agent_turn", "research_area", "deep_research"]) {
  await metadata.registerWorkflowDef(load(`${name}.json`), true);
  console.log(`registered workflow ${name}`);
}

// The SDK keeps a token refresh timer alive, so exit explicitly.
process.exit(0);
