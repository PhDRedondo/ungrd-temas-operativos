/**
 * Reimporta Puentes desde Excel (inventario + bitácora + estructuración).
 *
 * Uso:
 *   npx tsx scripts/reimport-puentes.ts
 *   npx tsx scripts/reimport-puentes.ts "/ruta/puentes (1) 2.xlsx"
 *   npx tsx scripts/reimport-puentes.ts "/ruta/archivo.xlsx" --seed-procesos
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { ensureUser } from "../src/lib/records/repository";
import { runPuentesReimport } from "../src/lib/uploads/puentes-reimport";

const DEFAULT_FILE = path.join(
  process.env.HOME || "",
  "Downloads",
  "puentes 2.xlsx",
);

const SEED_PROCESOS = process.argv.includes("--seed-procesos");

async function main() {
  const filePath =
    process.argv.slice(2).find((a) => !a.startsWith("--")) || DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const userId = await ensureUser({
    keycloakSub: "import-script",
    email: "import@ungrd.gov.co",
    name: "Importador",
    role: "admin",
  });

  console.log("Leyendo", filePath);
  const buffer = fs.readFileSync(filePath);
  const result = await runPuentesReimport({
    buffer,
    userId,
    seedProcesos: SEED_PROCESOS,
    log: (msg) => console.log(msg),
  });

  if (result.huerfanos) {
    console.log(
      `Aviso · ${result.huerfanos} puente(s) sin proceso estructurado previo:`,
    );
    for (const h of result.huerfanosSample) {
      console.log(`  - ${h.id} → ${h.contrato}`);
    }
    if (result.huerfanos > result.huerfanosSample.length) {
      console.log(
        `  … y ${result.huerfanos - result.huerfanosSample.length} más`,
      );
    }
    if (!SEED_PROCESOS) {
      console.log(
        "Sugerencia: correr con --seed-procesos para crear la etapa inicial de esos procesos.",
      );
    }
  }

  console.log(
    `Inventario: convenio_o_cto propagado a ${result.convenioBackfilled} registro(s)`,
  );
  console.log(
    `Inventario sync OK: ${result.inventarioSynced}/${result.inventarioSyncTotal}`,
  );
  if (result.procesosSeeded) {
    console.log(`Procesos sembrados en Estructuración: ${result.procesosSeeded}`);
  }
  if (result.errorSample.length) {
    console.log(
      "Muestra errores:",
      JSON.stringify(result.errorSample.slice(0, 8), null, 2),
    );
  }
  console.log("✓ Reimport Puentes completado", {
    softDeleted: result.softDeleted,
    estructuracion: result.estructuracion.inserted,
    inventario: result.inventario.inserted,
    bitacora: result.bitacora.inserted,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
