/**
 * harness — orquestador env → back → front
 */
import { spawnSync } from "child_process";
import path from "path";

const steps = [
  "check-env.ts",
  "check-back.ts",
  "check-platform.ts",
  "check-front.ts",
  "check-security.ts",
] as const;

function run(file: string) {
  const script = path.join("scripts", "harness", file);
  console.log(`\n──────── ${file} ────────`);
  const r = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

console.log("UNGRD harness — env + back + front");
for (const s of steps) run(s);
console.log("\n=== HARNESS ALL PASS ===\n");
