/**
 * Actualiza solo Banco de Maquinaria + Puentes desde Excel oficiales.
 * Soft-delete del tema → reimport. No toca otros temas ni lógica de UI.
 *
 * Uso:
 *   npx tsx scripts/update-banco-puentes.ts \
 *     "/ruta/Banco de Maquinaria.xlsx" \
 *     "/ruta/puentes.xlsx"
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import { spawnSync } from "child_process";
import { sql } from "drizzle-orm";
import {
  adminUrlFromMedallion,
  maskDbUrl,
} from "./lib/medallion-db-url";

const bancoFile = process.argv[2];
const puentesFile = process.argv[3];

if (!bancoFile || !puentesFile) {
  console.error(
    "Uso: npx tsx scripts/update-banco-puentes.ts <banco.xlsx> <puentes.xlsx>",
  );
  process.exit(1);
}
if (!fs.existsSync(bancoFile)) throw new Error(`No existe: ${bancoFile}`);
if (!fs.existsSync(puentesFile)) throw new Error(`No existe: ${puentesFile}`);

const med = process.env.MEDALLION_DATABASE_URL || "";
if (!med) throw new Error("Falta MEDALLION_DATABASE_URL en .env.local");

// Forzar escritura a Supabase prod (no localhost).
const adminUrl = adminUrlFromMedallion(med);
process.env.DATABASE_URL = adminUrl;
console.log("DB destino:", maskDbUrl(adminUrl));

async function softDeleteTheme(themeId: string) {
  // Import dinámico después de fijar DATABASE_URL
  const { db } = await import("../src/db");
  const res = await db.execute(sql`
    UPDATE records
    SET
      deleted_at = NOW(),
      updated_at = NOW(),
      content_hash = content_hash || '-del-' || id::text
    WHERE theme_id = ${themeId}
      AND deleted_at IS NULL
    RETURNING id
  `);
  const n = Array.isArray(res) ? res.length : Number((res as { rowCount?: number }).rowCount || 0);
  console.log(`Soft-delete ${themeId}: ${n}`);
  return n;
}

async function countTheme(themeId: string) {
  const { db } = await import("../src/db");
  const res = await db.execute(sql`
    SELECT
      coalesce(payload->>'capa', payload->>'tipo_registro', '(sin)') AS capa,
      count(*)::int AS n,
      coalesce(sum(valor),0)::float AS valor
    FROM records
    WHERE theme_id = ${themeId} AND deleted_at IS NULL
    GROUP BY 1
    ORDER BY n DESC
  `);
  console.log(`Estado ${themeId}:`, (res as { rows?: unknown }).rows ?? res);
}

function runImport(theme: string, file: string, sheet: string) {
  console.log(`\n── Import ${theme} · ${sheet}`);
  const r = spawnSync(
    "npx",
    ["tsx", "scripts/import-source-file.ts", theme, file, sheet],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: adminUrl },
      shell: process.platform === "win32",
    },
  );
  if (r.status !== 0) {
    throw new Error(`Falló import ${theme}/${sheet} status=${r.status}`);
  }
}

async function main() {
  console.log("\n=== ANTES ===");
  await countTheme("banco-de-maquinaria");
  await countTheme("puentes");

  await softDeleteTheme("banco-de-maquinaria");

  // Hojas del Excel actual (nombres largos; hint hace match por includes)
  runImport("banco-de-maquinaria", bancoFile, "DETALLE");
  runImport("banco-de-maquinaria", bancoFile, "CONVENIOS");
  runImport("banco-de-maquinaria", bancoFile, "BITACORA");
  runImport("banco-de-maquinaria", bancoFile, "ENTREGA");

  console.log("\n── Reimport Puentes (soft-delete interno)");
  const pr = spawnSync(
    "npx",
    ["tsx", "scripts/reimport-puentes.ts", puentesFile, "--seed-procesos"],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: adminUrl },
      shell: process.platform === "win32",
    },
  );
  if (pr.status !== 0) {
    throw new Error(`Falló reimport puentes status=${pr.status}`);
  }

  console.log("\n=== DESPUÉS ===");
  await countTheme("banco-de-maquinaria");
  await countTheme("puentes");
  console.log("\n✅ Actualización banco + puentes completada");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
