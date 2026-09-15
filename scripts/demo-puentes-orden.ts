/**
 * Demostración del orden de alimentación de Puentes:
 * Contrato estructuración → Inventario puente → Bitácora estado.
 *
 * Solo lectura: no crea ni modifica registros.
 *
 * Uso:
 *   npx tsx scripts/demo-puentes-orden.ts
 *   npx tsx scripts/demo-puentes-orden.ts "9677-CV020"
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../src/db";
import { records } from "../src/db/schema";
import { dbToRow } from "../src/lib/records/db-to-row";
import {
  searchThemeProcesos,
  type ProcesoLookupHit,
} from "../src/lib/records/puente-lookup";
import { normalizeClaveProceso } from "../src/themes/puentes/process-keys";

const THEME_ID = "puentes";

const CAPAS = [
  "Contrato estructuración",
  "Inventario puente",
  "Bitácora estado",
] as const;

function alive() {
  return and(eq(records.themeId, THEME_ID), isNull(records.deletedAt));
}

function capaEq(capa: string) {
  return sql`coalesce(${records.payload}->>'capa', ${records.payload}->>'tipo_registro','') = ${capa}`;
}

async function countCapa(capa: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(records)
    .where(and(alive(), capaEq(capa)));
  return row?.n ?? 0;
}

async function rowsOfCapa(capa: string) {
  const rows = await db.select().from(records).where(and(alive(), capaEq(capa)));
  return rows.map(dbToRow);
}

function claveDe(contrato: unknown) {
  const s = String(contrato || "").trim();
  return s ? normalizeClaveProceso(s).toLowerCase() : "";
}

async function main() {
  const filtro = process.argv.slice(2).find((a) => !a.startsWith("--")) || "";

  console.log("═".repeat(74));
  console.log("ORDEN DE ALIMENTACIÓN · PUENTES");
  console.log("═".repeat(74));

  for (const [i, capa] of CAPAS.entries()) {
    const n = await countCapa(capa);
    console.log(`  ${i + 1}. ${capa.padEnd(26)} ${String(n).padStart(5)} registros`);
  }

  const inventario = await rowsOfCapa("Inventario puente");
  const bitacora = await rowsOfCapa("Bitácora estado");

  // Paso 1 · procesos estructurados
  const procesos = await searchThemeProcesos({ q: filtro, limit: 40 });
  const estructurados = procesos.filter((p) => p.estructurado);
  const soloReferenciados = procesos.filter((p) => !p.estructurado);

  console.log("\n" + "─".repeat(74));
  console.log("PASO 1 · Procesos con estructuración registrada (raíz del flujo)");
  console.log("─".repeat(74));
  if (!estructurados.length) {
    console.log("  (ninguno) La capa Estructuración está vacía para este filtro.");
  }

  const eventosPorPuente = new Map<string, number>();
  for (const b of bitacora) {
    const idp = String(b.id_puente || b.clave_seguimiento || "")
      .trim()
      .toLowerCase();
    if (!idp) continue;
    eventosPorPuente.set(idp, (eventosPorPuente.get(idp) || 0) + 1);
  }

  function puentesDe(p: ProcesoLookupHit) {
    const clave = p.clave_proceso.toLowerCase();
    return inventario.filter(
      (r) => claveDe(r.contrato_convenio || r.contrato) === clave,
    );
  }

  for (const p of estructurados.slice(0, 6)) {
    const puentes = puentesDe(p);
    const totalEventos = puentes.reduce(
      (acc, r) =>
        acc +
        (eventosPorPuente.get(
          String(r.id_puente || r.clave_seguimiento || "").trim().toLowerCase(),
        ) || 0),
      0,
    );
    console.log(`\n  ▸ ${p.contrato_convenio}`);
    console.log(
      `    clave: ${p.clave_proceso} · vínculo: ${p.tipo_vinculo} · etapas: ${p.etapas_registradas}`,
    );
    if (p.descripcion_proceso) {
      console.log(`    objeto: ${p.descripcion_proceso.slice(0, 96)}…`);
    }
    console.log(
      `    PASO 2 · puentes nacidos del proceso: ${puentes.length} · PASO 3 · eventos de bitácora: ${totalEventos}`,
    );
    for (const r of puentes.slice(0, 5)) {
      const idp = String(r.id_puente || r.clave_seguimiento || "").trim();
      const ev = eventosPorPuente.get(idp.toLowerCase()) || 0;
      console.log(
        `        · ${String(r.codigo_operativo || "—").padEnd(16)} id ${idp.padEnd(6)} ${String(
          r.tipo || "",
        ).padEnd(12)} ${String(r.departamento || "")}/${String(r.municipio || "")} · ${ev} evento(s)`,
      );
    }
    if (puentes.length > 5) console.log(`        … y ${puentes.length - 5} más`);
  }

  console.log("\n" + "─".repeat(74));
  console.log("INTEGRIDAD · puentes cuyo proceso no está estructurado todavía");
  console.log("─".repeat(74));
  const clavesEstructuradas = new Set(
    estructurados.map((p) => p.clave_proceso.toLowerCase()),
  );
  const huerfanos = inventario.filter((r) => {
    const clave = claveDe(r.contrato_convenio || r.contrato);
    return !clave || !clavesEstructuradas.has(clave);
  });
  const porContrato = new Map<string, number>();
  for (const r of huerfanos) {
    const key = String(r.contrato_convenio || r.contrato || "(sin contrato)").trim();
    porContrato.set(key, (porContrato.get(key) || 0) + 1);
  }
  console.log(
    `  ${huerfanos.length} puente(s) en ${porContrato.size} proceso(s) sin etapa en Estructuración:`,
  );
  for (const [contrato, n] of [...porContrato.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)) {
    console.log(`    - ${contrato.padEnd(46)} ${n} puente(s)`);
  }
  if (soloReferenciados.length) {
    console.log(
      `\n  ${soloReferenciados.length} proceso(s) existen solo referenciados desde inventario.`,
    );
    console.log(
      "  Para cerrar el orden: npx tsx scripts/reimport-puentes.ts <archivo> --seed-procesos",
    );
  }

  console.log("\n✓ Demostración completada (solo lectura)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
