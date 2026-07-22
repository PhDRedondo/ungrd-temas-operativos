/**
 * Reimporta todas las capas reales (maqueta/bitácora/control/pagos/…)
 * con tipo_registro + capa + clave_seguimiento.
 *
 * Uso: npx tsx scripts/prep-reimport-all.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { spawnSync } from "child_process";
import path from "path";

const DL = path.join(process.env.HOME!, "Downloads");

const JOBS: Array<{ theme: string; file: string; sheet: string }> = [
  {
    theme: "puentes",
    file: "2025-08-19 CONSOLIDADO DE PUENTES SMD  ARCGIS DRIVE.xlsx",
    sheet: "PUENTES",
  },
  {
    theme: "obras-de-emergencia",
    file: "2025-08-21 OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    sheet: "OBRAS DE EMERGENCIA",
  },
  {
    theme: "obras-de-emergencia",
    file: "2025-08-25 O.P. OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    sheet: "O.P.",
  },
  {
    theme: "obras-por-impuestos",
    file: "2025-09-15 OBRAS POR IMPUESTO ARCGIS DRIVE.xlsx",
    sheet: "OBRAS POR IMPUESTO",
  },
  {
    theme: "declaratoria-de-emergencia",
    file: "2025-08-14 DECLATARORIAS DE CALAMIDAD ARCGIS.xlsx",
    sheet: "DECRETOS",
  },
  {
    theme: "banco-de-maquinaria",
    file: "Banco de Maquinaria.xlsx",
    sheet: "DETALLE",
  },
  {
    theme: "banco-de-maquinaria",
    file: "Banco de Maquinaria.xlsx",
    sheet: "CONVENIOS",
  },
  {
    theme: "banco-de-maquinaria",
    file: "Banco de Maquinaria.xlsx",
    sheet: "BITACORA",
  },
  {
    theme: "banco-de-maquinaria",
    file: "Banco de Maquinaria.xlsx",
    sheet: "ENTREGA",
  },
  {
    theme: "carrotanques",
    file: "maqueta carrotanques (2).xlsx",
    sheet: "MAQUETA",
  },
  {
    theme: "carrotanques",
    file: "Bitacora Carrotanques.xlsx",
    sheet: "Bitacora",
  },
  {
    theme: "carrotanques",
    file: "Bitacora Carrotanques.xlsx",
    sheet: "SUMINISTRO",
  },
  {
    theme: "agua-y-saneamiento",
    file: "Maqueta Agua y Saneamiento.xlsx",
    sheet: "General",
  },
  {
    theme: "agua-y-saneamiento",
    file: "Maqueta Agua y Saneamiento.xlsx",
    sheet: "control",
  },
  {
    theme: "agua-y-saneamiento",
    file: "Maqueta Agua y Saneamiento.xlsx",
    sheet: "modificacion",
  },
  {
    theme: "agua-y-saneamiento",
    file: "Bitacora Agua y Saneamiento def.xlsx",
    sheet: "bitacora",
  },
  {
    theme: "agua-y-saneamiento",
    file: "Bitacora Agua y Saneamiento def.xlsx",
    sheet: "PAGOS",
  },
  // FIC — una hoja por vigencia
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2014",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2015",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2016",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2017",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2018",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2019",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "Transferencias -FIC-2020",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFRENCIAS - FIC - 2021",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFRENCIAS - FIC - 2022",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFERENCIAS FIC - 2023",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFERENCIAS - FIC - 2023",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFERENCIAS - FIC - 2024",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFERENCIAS - FIC - 2025",
  },
  {
    theme: "fic",
    file: "Seguimiento_FIC_2026.xlsx",
    sheet: "TRANSFERENCIAS - FIC - 2026",
  },
];

function run(theme: string, file: string, sheet: string) {
  const filePath = path.join(DL, file);
  console.log(`\n════════ ${theme} · ${sheet} ════════`);
  const r = spawnSync(
    "npx",
    ["tsx", "scripts/import-source-file.ts", theme, filePath, sheet],
    { stdio: "inherit", env: process.env, shell: process.platform === "win32" },
  );
  if (r.status !== 0) {
    console.error(`⚠ Falló ${theme}/${sheet} (status ${r.status}) — continúo`);
  }
}

console.log("Prep reimport — todas las capas con clave_seguimiento");
for (const j of JOBS) run(j.theme, j.file, j.sheet);
console.log("\n✅ Reimport terminado");
