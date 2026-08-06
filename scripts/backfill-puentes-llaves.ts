/**
 * Backfill de llaves derivadas en Puentes (no crea ni borra registros).
 *
 * Calcula sobre los registros ya existentes:
 *   origen_adquisicion, proceso_sigla, numero_unidad, codigo_operativo
 *
 * Inventario: numeración por proceso (orden estable por id_puente).
 * Bitácora / Estructuración: heredan las llaves del inventario.
 *
 * Uso:
 *   npx tsx scripts/backfill-puentes-llaves.ts            # dry-run
 *   npx tsx scripts/backfill-puentes-llaves.ts --apply    # escribe
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { records } from "../src/db/schema";
import { dbToRow } from "../src/lib/records/db-to-row";
import { getTheme } from "../src/themes";
import { patchRecordWithVersion } from "../src/lib/records/versions";
import { normalizePuenteCapa } from "../src/themes/puentes/capture-forms";
import { applyProcesoKeys } from "../src/themes/puentes/process-keys";
import { assignAssetKeys, ORIGEN_LABELS } from "../src/themes/puentes/asset-keys";

const THEME_ID = "puentes";
const CAPA_INVENTARIO = "Inventario puente";

const APPLY = process.argv.includes("--apply");

type Loaded = {
  recordId: string;
  capa: string;
  idPuente: string;
  contrato: string;
  tipoVinculo: string;
  current: {
    codigo_operativo: string;
    numero_unidad: string;
    proceso_sigla: string;
    origen_adquisicion: string;
    clave_proceso: string;
  };
};

function idPuenteOf(r: Record<string, unknown>): string {
  return String(r.id_puente || r.id_legacy || r.clave_seguimiento || "").trim();
}

async function main() {
  const theme = getTheme(THEME_ID);
  if (!theme) throw new Error("Tema puentes no registrado");

  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.themeId, THEME_ID), isNull(records.deletedAt)));

  const loaded: Loaded[] = rows.map((row) => {
    const r = dbToRow(row) as Record<string, unknown>;
    const contrato = String(r.contrato_convenio || r.contrato || "").trim();
    return {
      recordId: row.id,
      capa: normalizePuenteCapa(String(r.tipo_registro || r.capa || "")),
      idPuente: idPuenteOf(r),
      contrato,
      tipoVinculo: String(r.tipo_vinculo || "").trim(),
      current: {
        codigo_operativo: String(r.codigo_operativo || "").trim(),
        numero_unidad: String(r.numero_unidad || "").trim(),
        proceso_sigla: String(r.proceso_sigla || "").trim(),
        origen_adquisicion: String(r.origen_adquisicion || "").trim(),
        clave_proceso: String(r.clave_proceso || "").trim(),
      },
    };
  });

  const inventario = loaded.filter(
    (l) => l.capa === normalizePuenteCapa(CAPA_INVENTARIO) && l.idPuente,
  );

  const keysByPuente = assignAssetKeys(
    inventario.map((l) => ({
      id_puente: l.idPuente,
      contrato_convenio: l.contrato,
      tipo_vinculo: l.tipoVinculo,
    })),
  );

  console.log(
    `\nRegistros vivos: ${loaded.length} | inventario: ${inventario.length} | procesos: ${
      new Set([...keysByPuente.values()].map((k) => k.proceso_sigla || "—")).size
    }`,
  );

  const porOrigen = new Map<string, number>();
  for (const k of keysByPuente.values()) {
    porOrigen.set(k.origen_adquisicion, (porOrigen.get(k.origen_adquisicion) || 0) + 1);
  }
  console.log("\nPuentes por origen de adquisición:");
  for (const [origen, count] of [...porOrigen].sort((a, b) => b[1] - a[1])) {
    const label = ORIGEN_LABELS[origen as keyof typeof ORIGEN_LABELS] || origen;
    console.log(`  ${label.padEnd(20)} ${count}`);
  }

  console.log("\nCódigos operativos asignados (inventario):");
  const sortedKeys = [...keysByPuente.values()].sort((a, b) =>
    (a.proceso_sigla + String(a.numero_unidad).padStart(3, "0")).localeCompare(
      b.proceso_sigla + String(b.numero_unidad).padStart(3, "0"),
      "es",
    ),
  );
  for (const k of sortedKeys) {
    console.log(
      `  ${k.codigo_operativo.padEnd(16)} ← id_puente ${k.id_puente.padEnd(6)} ${
        ORIGEN_LABELS[k.origen_adquisicion]
      }`,
    );
  }

  let planned = 0;
  let applied = 0;
  let skipped = 0;
  const failures: { recordId: string; error: string }[] = [];

  for (const item of loaded) {
    const keys = item.idPuente ? keysByPuente.get(item.idPuente) : undefined;

    const patch: Record<string, unknown> = {};

    if (keys) {
      if (item.current.codigo_operativo !== keys.codigo_operativo) {
        patch.codigo_operativo = keys.codigo_operativo;
      }
      if (item.current.numero_unidad !== String(keys.numero_unidad)) {
        patch.numero_unidad = keys.numero_unidad;
      }
      if (item.current.proceso_sigla !== keys.proceso_sigla) {
        patch.proceso_sigla = keys.proceso_sigla;
      }
      if (item.current.origen_adquisicion !== keys.origen_adquisicion) {
        patch.origen_adquisicion = keys.origen_adquisicion;
      }
      if (keys.clave_proceso && item.current.clave_proceso !== keys.clave_proceso) {
        patch.clave_proceso = keys.clave_proceso;
      }
    } else if (item.contrato) {
      // Estructuración (sin id_puente): al menos proceso + origen.
      const proc = applyProcesoKeys({
        contrato_convenio: item.contrato,
        tipo_vinculo: item.tipoVinculo,
      });
      const derived = assignAssetKeys([
        {
          id_puente: "1",
          contrato_convenio: item.contrato,
          tipo_vinculo: String(proc.tipo_vinculo || ""),
        },
      ]).get("1");
      if (derived) {
        if (item.current.proceso_sigla !== derived.proceso_sigla) {
          patch.proceso_sigla = derived.proceso_sigla;
        }
        if (item.current.origen_adquisicion !== derived.origen_adquisicion) {
          patch.origen_adquisicion = derived.origen_adquisicion;
        }
        if (
          derived.clave_proceso &&
          item.current.clave_proceso !== derived.clave_proceso
        ) {
          patch.clave_proceso = derived.clave_proceso;
        }
      }
    }

    if (!Object.keys(patch).length) {
      skipped += 1;
      continue;
    }
    planned += 1;

    if (!APPLY) continue;

    try {
      await patchRecordWithVersion({
        theme,
        recordId: item.recordId,
        patch,
        reason: "backfill llaves derivadas (código operativo / origen / proceso)",
      });
      applied += 1;
    } catch (err) {
      failures.push({
        recordId: item.recordId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `\n${APPLY ? "APLICADO" : "DRY-RUN"} → con cambios: ${planned} | sin cambios: ${skipped}${
      APPLY ? ` | escritos: ${applied}` : ""
    }`,
  );
  if (failures.length) {
    console.log(`\nFallos (${failures.length}):`);
    for (const f of failures.slice(0, 10)) {
      console.log(`  ${f.recordId}: ${f.error}`);
    }
  }
  if (!APPLY) {
    console.log("\nPara escribir: npx tsx scripts/backfill-puentes-llaves.ts --apply");
  }

  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
