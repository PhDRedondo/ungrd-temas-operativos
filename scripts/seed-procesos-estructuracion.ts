/**
 * Crea la etapa raíz en Estructuración para los procesos que solo existen
 * referenciados desde el inventario (orden proceso → puente → evento).
 *
 * No inventa procesos ni puentes: usa el contrato/donación ya presente en el
 * inventario. Dry-run por defecto.
 *
 * Uso:
 *   npx tsx scripts/seed-procesos-estructuracion.ts           # simulación
 *   npx tsx scripts/seed-procesos-estructuracion.ts --apply   # escribe
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { records } from "../src/db/schema";
import { getTheme } from "../src/themes";
import { dbToRow } from "../src/lib/records/db-to-row";
import {
  insertValidatedRecords,
  upsertThemeCatalog,
  ensureUser,
} from "../src/lib/records/repository";
import { prepareTrackingRow } from "../src/lib/uploads/capa-inference";
import { validateRow } from "../src/lib/validation/record-schema";
import { normalizeClaveProceso } from "../src/themes/puentes/process-keys";
import {
  CAPA_ESTRUCTURACION,
  buildProcesoSeedRow,
  groupProcesosPendientes,
  type InventarioRef,
} from "../src/themes/puentes/proceso-seed";
import type { ValidatedRecord } from "../src/lib/validation/record-schema";

const THEME_ID = "puentes";
const APPLY = process.argv.includes("--apply");

function capaEq(capa: string) {
  return sql`coalesce(${records.payload}->>'capa', ${records.payload}->>'tipo_registro','') = ${capa}`;
}

async function rowsOfCapa(capa: string) {
  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaEq(capa),
      ),
    );
  return rows.map(dbToRow);
}

async function main() {
  const theme = getTheme(THEME_ID);
  if (!theme) throw new Error("Tema puentes no encontrado");

  const estructuracion = await rowsOfCapa(CAPA_ESTRUCTURACION);
  const inventario = await rowsOfCapa("Inventario puente");

  const yaEstructuradas = new Set<string>();
  for (const r of estructuracion) {
    const contrato = String(r.contrato_convenio || r.contrato || "").trim();
    if (!contrato) continue;
    yaEstructuradas.add(normalizeClaveProceso(contrato).toLowerCase());
  }

  const refs: InventarioRef[] = inventario.map((r) => ({
    idPuente: String(r.id_puente || r.clave_seguimiento || "").trim(),
    contrato: String(r.contrato_convenio || r.contrato || "").trim(),
    descripcion: String(r.descripcion_proceso || ""),
  }));

  const pendientes = groupProcesosPendientes(refs, yaEstructuradas);

  console.log(
    `Estructuración actual: ${estructuracion.length} etapa(s) · ${yaEstructuradas.size} proceso(s)`,
  );
  console.log(`Inventario: ${inventario.length} puente(s)`);
  console.log(`Procesos sin raíz: ${pendientes.length}`);
  for (const p of pendientes) {
    console.log(
      `  - ${p.contrato} → clave ${p.clave} · ${p.tipoVinculo} · ${p.puentes.length} puente(s)`,
    );
  }

  const sinContrato = refs.filter((r) => !r.contrato).length;
  if (sinContrato) {
    console.log(
      `Aviso · ${sinContrato} puente(s) sin contrato: requieren corrección manual (no se pueden vincular a un proceso).`,
    );
  }

  if (!pendientes.length) {
    console.log("✓ Nada por sembrar: todo puente nace de un proceso estructurado.");
    return;
  }

  if (!APPLY) {
    console.log("\n(dry-run) Correr con --apply para crear las etapas raíz.");
    return;
  }

  await upsertThemeCatalog(theme);
  const userId = await ensureUser({
    keycloakSub: "import-script",
    email: "import@ungrd.gov.co",
    name: "Importador",
    role: "admin",
  });

  const items: ValidatedRecord[] = [];
  for (const p of pendientes) {
    const prepared = prepareTrackingRow(theme, buildProcesoSeedRow(p), {
      hint: "Contratos Estructuracion",
    });
    const result = validateRow(theme, prepared, 0);
    if (result.ok) items.push(result.data);
    else console.log(`  ✗ ${p.contrato}:`, JSON.stringify(result.errors));
  }

  const { inserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items,
    source: "manual",
    userId,
  });
  console.log(`\n✓ Etapas raíz creadas: ${inserted.length}/${pendientes.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
