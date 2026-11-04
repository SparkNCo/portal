// Compares docker/supabase/functions.env with the cloud project's edge function
// secrets without printing any value: Supabase only exposes a SHA-256 digest of
// each secret, so we hash the local value and compare.
//
// Usage (from the repo root, with the Supabase CLI logged in):
//   node docker/supabase/portal/check-functions-env.mjs

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "ozybsusoollnomaaxkcy";
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "functions.env");

const local = new Map();
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match) {
    local.set(match[1], match[2].replace(/^["']|["']$/g, ""));
  }
}

const listed = execSync(`npx supabase secrets list --project-ref ${PROJECT_REF} -o json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const cloud = new Map(JSON.parse(listed).map((secret) => [secret.name, secret.value]));

const counts = { same: 0, different: 0, empty: 0, notInCloud: 0 };
for (const [name, value] of local) {
  let status;
  if (value === "") {
    status = "empty";
    counts.empty++;
  } else if (!cloud.has(name)) {
    status = "not in the cloud";
    counts.notInCloud++;
  } else if (createHash("sha256").update(value).digest("hex") === cloud.get(name)) {
    status = "same as cloud";
    counts.same++;
  } else {
    status = "DIFFERENT from cloud";
    counts.different++;
  }
  console.log(`${name.padEnd(28)} ${status}`);
}

console.log(
  `\n${counts.same} same, ${counts.different} different, ${counts.empty} empty, ${counts.notInCloud} not in the cloud`
);
