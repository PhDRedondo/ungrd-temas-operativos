/**
 * Normaliza departamento/municipio de records al catálogo DIVIPOLA.
 * No inventa territorio (Cruz Roja, SENA, etc. se dejan).
 *
 *   npx tsx scripts/backfill-divipola-geo.ts              # dry-run
 *   npx tsx scripts/backfill-divipola-geo.ts --apply      # escribe
 *   npx tsx scripts/backfill-divipola-geo.ts --theme=fic --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { records } from "../src/db/schema";
import { findDepartment, normalizeRecordGeo } from "../src/lib/geo";

const APPLY = process.argv.includes("--apply");
const themeArg = process.argv.find((a) => a.startsWith("--theme="));
const THEME_ID = themeArg ? themeArg.slice("--theme=".length).trim() : "";

function payloadGeo(
  payload: Record<string, unknown>,
  departamento: string,
  municipio: string,
): Record<string, unknown> | null {
  let changed = false;
  const next = { ...payload };
  if ("departamento" in next && String(next.departamento) !== departamento) {
    next.departamento = departamento;
    changed = true;
  }
  if ("municipio" in next && String(next.municipio) !== municipio) {
    next.municipio = municipio;
    changed = true;
  }
  return changed ? next : null;
}

async function main() {
  const where = THEME_ID
    ? and(eq(records.themeId, THEME_ID), isNull(records.deletedAt))
    : isNull(records.deletedAt);

  const rows = await db
    .select({
      id: records.id,
      themeId: records.themeId,
      departamento: records.departamento,
      municipio: records.municipio,
      payload: records.payload,
    })
    .from(records)
    .where(where);

  type Pending = {
    id: string;
    departamento: string;
    municipio: string;
    payload: Record<string, unknown> | null;
  };
  const pending: Pending[] = [];
  const unmatched = new Map<string, number>();
  const samples: string[] = [];

  for (const r of rows) {
    const geo = normalizeRecordGeo(r.departamento, r.municipio);
    const payloadNext = payloadGeo(
      (r.payload || {}) as Record<string, unknown>,
      geo.departamento,
      geo.municipio,
    );
    const colsChanged =
      geo.departamento !== r.departamento || geo.municipio !== r.municipio;

    if (!colsChanged) {
      const raw = String(r.departamento || "").replace(/\s+/g, " ").trim();
      if (raw && !/^sin departamento$/i.test(raw) && !findDepartment(raw)) {
        unmatched.set(
          `${r.themeId}|${raw}`,
          (unmatched.get(`${r.themeId}|${raw}`) || 0) + 1,
        );
      }
    }

    if (!colsChanged && !payloadNext) continue;

    if (samples.length < 12) {
      samples.push(
        `${r.themeId} ${r.departamento} / ${r.municipio} → ${geo.departamento} / ${geo.municipio}`,
      );
    }
    pending.push({
      id: r.id,
      departamento: geo.departamento || r.departamento,
      municipio: geo.municipio || r.municipio,
      payload: payloadNext,
    });
  }

  if (APPLY && pending.length) {
    const BATCH = 40;
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      await Promise.all(
        chunk.map((c) =>
          db
            .update(records)
            .set({
              departamento: c.departamento,
              municipio: c.municipio,
              ...(c.payload ? { payload: c.payload } : {}),
              updatedAt: new Date(),
            })
            .where(eq(records.id, c.id)),
        ),
      );
      console.log(`  escritos ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
    }
  }

  console.log(
    APPLY ? "APPLY" : "DRY-RUN",
    THEME_ID || "todas las bases",
    `filas=${rows.length}`,
    `a_normalizar=${pending.length}`,
  );
  for (const s of samples) console.log(" ", s);
  const leftover = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (leftover.length) {
    console.log("Sin match DIVIPOLA (se dejan):");
    for (const [k, n] of leftover) console.log(`  ${n}\t${k}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
