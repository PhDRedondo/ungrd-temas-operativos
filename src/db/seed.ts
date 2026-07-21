import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { records, themes } from "@/db/schema";
import { THEMES } from "@/themes";
import { DEPARTMENTS } from "@/lib/geo";
import { upsertThemeCatalog } from "@/lib/records/repository";
import { rowContentHash } from "@/lib/validation/record-schema";

const ESTADOS = ["Programado", "En ejecución", "Finalizado", "Suspendido"] as const;

function seed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function rng(s: number) {
  let x = s || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

async function main() {
  console.log("→ Sincronizando catálogo de temas…");
  for (const theme of THEMES) {
    await upsertThemeCatalog(theme);
  }
  console.log(`  ${THEMES.length} temas OK`);

  console.log("→ Sembrando registros demo (si el tema está vacío)…");
  let insertedTotal = 0;

  for (const theme of THEMES) {
    const existing = await db
      .select({ id: records.id })
      .from(records)
      .where(eq(records.themeId, theme.id))
      .limit(1);
    if (existing.length) continue;

    const rand = rng(seed(theme.id));
    const rows = [];
    for (let i = 0; i < 48; i++) {
      const dept = pick(rand, DEPARTMENTS);
      const muni = pick(rand, dept.municipalities);
      const estado = pick(rand, ESTADOS);
      const month = String(Math.floor(rand() * 12) + 1).padStart(2, "0");
      const day = String(Math.floor(rand() * 28) + 1).padStart(2, "0");
      const year = rand() > 0.35 ? 2026 : 2025;
      const fecha = `${year}-${month}-${day}`;
      const valor = Math.round((rand() * 800 + 50) * 1_000_000);

      const payload: Record<string, string | number> = { observaciones: "" };
      const raw: Record<string, string | number> = {
        departamento: dept.name,
        municipio: muni.name,
        fecha,
        estado,
        valor,
      };

      for (const field of theme.fields) {
        if (
          ["departamento", "municipio", "fecha", "estado", "valor"].includes(
            field.name,
          )
        ) {
          continue;
        }
        if (field.type === "select" && field.options?.length) {
          const v = pick(rand, field.options);
          payload[field.name] = v;
          raw[field.name] = v;
        } else if (field.type === "number") {
          const v = Math.round(rand() * 500 + 10);
          payload[field.name] = v;
          raw[field.name] = v;
        } else if (field.type === "date") {
          payload[field.name] = fecha;
          raw[field.name] = fecha;
        } else if (field.name === "observaciones") {
          payload[field.name] = "";
        } else {
          const v = `${field.label} ${i + 1}`;
          payload[field.name] = v;
          raw[field.name] = v;
        }
      }

      rows.push({
        themeId: theme.id,
        departamento: dept.name,
        municipio: muni.name,
        fecha,
        estado,
        valor: String(valor),
        payload,
        source: "seed",
        contentHash: rowContentHash(theme.id, raw),
      });
    }

    await db.insert(records).values(rows);
    insertedTotal += rows.length;
    console.log(`  ${theme.id}: ${rows.length} filas`);
  }

  const themeCount = await db.select().from(themes);
  console.log(
    `✓ Seed listo. Temas=${themeCount.length}, nuevos registros=${insertedTotal}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
