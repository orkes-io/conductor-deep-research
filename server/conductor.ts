// Conductor clients, the model roster and the Conductor UI base URL, shared by the API routes.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OrkesClients } from "@io-orkes/conductor-javascript";

export interface ModelConfig {
  kind: string; // provider family; a reviewer is always a different kind than its researcher
  transport?: "conductor" | "mistral_conversations"; // how the model is called (default: Conductor's LLM task)
  llmProvider?: string; // integration name in Conductor (not used by the Mistral route)
  model: string;
  label: string;
  reasoningEffort?: string;
}

// Reads CONDUCTOR_SERVER_URL, CONDUCTOR_AUTH_KEY and CONDUCTOR_AUTH_SECRET from the environment.
export const clients = await OrkesClients.from();
export const workflows = clients.getWorkflowClient();

// models.local.json (gitignored) wins over models.json, so you can use your own integration names.
const root = join(import.meta.dirname, "..");
const modelsFile = existsSync(join(root, "models.local.json")) ? "models.local.json" : "models.json";
export const models: ModelConfig[] = JSON.parse(readFileSync(join(root, modelsFile), "utf8"));

// https://developer.orkescloud.com/api -> https://developer.orkescloud.com
export const uiBase = (process.env.CONDUCTOR_SERVER_URL ?? "").replace(/\/api\/?$/, "");
