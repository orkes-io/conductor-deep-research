// Builds the workflow and task definitions in conductor/dist from the sources in conductor/.
// Any string value of the form "@include:<path>" is replaced with the contents of conductor/<path>,
// so prompts and JQ programs live in their own files. "@include:owner" becomes the owner email.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "conductor");
const OWNER = process.env.CONDUCTOR_OWNER_EMAIL || "deep-research@example.com";

function resolve(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("@include:")) {
    const target = value.slice("@include:".length);
    if (target === "owner") return OWNER;
    return readFileSync(join(ROOT, target), "utf8").trimEnd();
  }
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
  }
  return value;
}

mkdirSync(join(ROOT, "dist"), { recursive: true });
for (const dir of ["taskdefs", "src"]) {
  for (const file of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json"))) {
    const def = resolve(JSON.parse(readFileSync(join(ROOT, dir, file), "utf8")));
    const out = join(ROOT, "dist", dir === "taskdefs" ? `taskdef.${file}` : file);
    writeFileSync(out, JSON.stringify(def, null, 2) + "\n");
    console.log(`wrote ${out.slice(ROOT.length + 1)}`);
  }
}
