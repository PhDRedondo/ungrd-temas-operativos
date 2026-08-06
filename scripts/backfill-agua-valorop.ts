/**
 * Backfill valor (ValorOP) de Maqueta Excel → registros Alta Agua.
 * Corrige import donde ValorOP no quedó en columna valor.
 *
 *   npx tsx scripts/backfill-agua-valorop.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import ExcelJS from "exceljs";
import { db } from "../src/db";
import { sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

const EXCEL_CANDIDATES = [
  path.join(
    process.env.HOME || "",
    "Downloads/Maqueta Agua y Saneamiento.xlsx",
  ),
  path.join(
    process.env.HOME || "",
    "Desktop/Johan/Comparacion_Agua_Saneamiento_Bases_vs_Formulario.xlsx",
  ),
];

function cellVal(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "object" && v !== null) {
    const o = v as { result?: unknown; text?: string };
    if (o.result != null) return o.result;
    if (o.text != null) return o.text;
  }
  return v;
}

async function loadValorMap(file: string): Promise<Map<string, number>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws =
    wb.getWorksheet("General") ||
    wb.getWorksheet("Maq_General") ||
    wb.worksheets[0];
  if (!ws) throw new Error(`Sin hoja en ${file}`);

  const headers: { i: number; v: string }[] = [];
  ws.getRow(1).eachCell((c, i) =>
    headers.push({ i, v: String(cellVal(c.value) ?? "").trim() }),
  );
  const opCol = headers.find((h) =>
    /orden.*proveedur/i.test(h.v),
  )?.i;
  const valorCol = headers.find((h) =>
    /^valorop$/i.test(h.v.replace(/\s/g, "")) || /^valor\s*op$/i.test(h.v),
  )?.i;
  if (!opCol || !valorCol) {
    throw new Error(
      `No encontré columnas OP/ValorOP en ${file} (op=${opCol}, valor=${valorCol})`,
    );
  }

  const map = new Map<string, number>();
  for (let r = 2; r <= (ws.rowCount || 0); r++) {
    const op = String(cellVal(ws.getRow(r).getCell(opCol).value) ?? "").trim();
    if (!op) continue;
    const raw = cellVal(ws.getRow(r).getCell(valorCol).value);
    const n =
      typeof raw === "number"
        ? raw
        : Number(String(raw ?? "").replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n === 0) continue;
    map.set(op, n);
  }
  return map;
}

async function main() {
  const file = EXCEL_CANDIDATES.find((f) => fs.existsSync(f));
  if (!file) {
    console.error("No encontré Maqueta Agua. Rutas:", EXCEL_CANDIDATES);
    process.exit(1);
  }
  console.log("Excel:", file);
  const map = await loadValorMap(file);
  console.log("OPs con ValorOP:", map.size);
  console.log("Ej. GS-SMD-678-2021:", map.get("GS-SMD-678-2021"));

  let updated = 0;
  for (const [op, valor] of map) {
    const r = await db.execute(sql`
      update records
      set
        valor = ${String(valor)},
        payload = jsonb_set(
          coalesce(payload, '{}'::jsonb),
          '{valor}',
          to_jsonb(${valor}::numeric)
        ),
        updated_at = now()
      where theme_id = 'agua-y-saneamiento'
        and deleted_at is null
        and coalesce(payload->>'capa','') in ('Alta / orden', 'Maqueta / orden')
        and (
          coalesce(payload->>'orden_de_proveeduria','') = ${op}
          or coalesce(payload->>'clave_seguimiento','') = ${op}
        )
        and (valor::numeric = 0 or valor is null)
    `);
    const n = Number((r as { rowCount?: number }).rowCount || 0);
    updated += n;
  }

  console.log("Filas Alta actualizadas:", updated);

  const check = await db.execute(sql`
    select coalesce(payload->>'orden_de_proveeduria','') as op,
           valor::text as col_valor,
           coalesce(payload->>'valor','') as pval
    from records
    where theme_id = 'agua-y-saneamiento' and deleted_at is null
      and coalesce(payload->>'orden_de_proveeduria','') = 'GS-SMD-678-2021'
      and coalesce(payload->>'capa','') = 'Alta / orden'
    limit 2
  `);
  console.log("Check GS-SMD-678-2021:", check);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
