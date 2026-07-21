/**
 * harness:env — prerequisitos locales
 */
import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { assert, ok, section } from "./lib";

function loadEnvFile() {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  section("Harness ENV");
  loadEnvFile();

  const major = Number(process.versions.node.split(".")[0]);
  assert(major >= 18, `Node >= 18 requerido (actual ${process.version})`);
  ok(`Node ${process.version}`);

  assert(existsSync(".env.example"), "falta .env.example");
  ok(".env.example presente");

  if (!existsSync(".env.local")) {
    console.warn("  ⚠ .env.local no existe — copiar desde .env.example");
  } else {
    ok(".env.local presente");
  }

  assert(process.env.DATABASE_URL, "DATABASE_URL no definido");
  ok("DATABASE_URL definido");

  assert(process.env.AUTH_SECRET, "AUTH_SECRET no definido");
  ok("AUTH_SECRET definido");

  const mode = process.env.AUTH_MODE || "demo";
  ok(`AUTH_MODE=${mode}`);

  assert(existsSync("data/divipola.json"), "falta data/divipola.json");
  ok("DIVIPOLA data/divipola.json");

  assert(
    existsSync("public/geo/departamentos-mgn2024.json"),
    "falta public/geo/departamentos-mgn2024.json",
  );
  ok("Geo MGN public/geo/...");

  assert(existsSync("docs/README.md"), "falta docs/");
  ok("docs/ presente");

  console.log("\n=== HARNESS ENV PASS ===\n");
}

main().catch((e) => {
  console.error("\n=== HARNESS ENV FAIL ===");
  console.error(e);
  process.exit(1);
});
