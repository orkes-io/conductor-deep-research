// Conductor clients, the model roster and the Conductor UI base URL, shared by the API routes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OrkesClients } from "@io-orkes/conductor-javascript";

export interface ModelConfig {
  kind: string; // provider family; a reviewer is always a different kind than its researcher
  llmProvider: string; // integration name in Conductor
  model: string;
  label: string;
  reasoningEffort?: string;
}

// Reads CONDUCTOR_SERVER_URL, CONDUCTOR_AUTH_KEY and CONDUCTOR_AUTH_SECRET from the environment.
export const clients = await OrkesClients.from();
export const workflows = clients.getWorkflowClient();

export const models: ModelConfig[] = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "models.json"), "utf8"),
);

// https://developer.orkescloud.com/api -> https://developer.orkescloud.com
export const uiBase = (process.env.CONDUCTOR_SERVER_URL ?? "").replace(/\/api\/?$/, "");
