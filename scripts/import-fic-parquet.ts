/**
 * Reemplaza records theme_id=fic con transferencias_fic.parquet (AppSheet / CONTROL FIC).
 *
 * Uso:
 *   npx tsx scripts/import-fic-parquet.ts
 *   npx tsx scripts/import-fic-parquet.ts /ruta/transferencias_fic.parquet
 *
 * Requiere DATABASE_URL (Supabase UNGRD) en .env.local.
 * Carga dotenv ANTES de importar `db` (los import ESM se hoistean).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env opcional

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";

const DEFAULT_PARQUET =
  "/Users/jackstive26/Downloads/transferencias_fic.parquet";

/** parquet (AppSheet) → campos del tema FIC */
const PARQUET_TO_THEME: Record<string, string> = {
  id_transferencia: "id_transferencia",
  vigencia: "vigencia",
  departamento: "departamento",
  municipio: "municipio",
  objeto_transferencia: "objeto_transferencia",
  tipo_evento: "tipo_de_evento",
  fecha_aprobacion_atencion: "fecha_formato_de_aprobacion_de_la_atencion",
  acto_administrativo: "acto_administrativo_otorgamiento_del_recurso",
  fecha_acto_administrativo: "fecha_acto_administrativo_resolucion",
  plazo_ejecucion_dias: "plazo_ejecucion_dias",
  clasificacion: "clasificacion",
  numero_cdp: "no_cdp",
  fecha_cdp: "fecha_cdp",
  numero_rc: "no_rc",
  fecha_rc: "fecha_rc",
  valor_desembolso: "valor",
  fecha_desembolso: "fecha",
  codigo_notificacion: "comunicacion_de_notificacion_ente_territorial",
  fecha_notificacion: "fecha_de_radicacion_comunicacion_ente_territorial",
  nombre_supervisor: "nombre_del_supervisor_administrativo",
  fecha_inicial_legalizacion: "fecha_inicial_para_legalizacion",
  responsabilidades_supervision:
    "responsabilidades_de_la_supervision_descripcion_de_las_acciones_",
  estado_legalizacion: "estado",
  valor_legalizado: "valor_legalizado",
  valor_por_legalizar: "valor_por_legalizar",
  porcentaje_avance_legalizacion:
    "porcentaje_de_avance_en_el_ejericicio_de_legalizacion",
  acto_administrativo_prorroga: "acto_administrativo_prorroga",
  plazo_adicion_dias: "plazo_adicion_dias",
  fecha_legalizacion_prorroga: "fecha_de_legalizacion_por_prorroga",
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  // AppSheet a veces mete "25-1067\\r\\n12/08/2025" en el CDP.
  const first = String(v).split(/\r?\n/)[0] ?? "";
  const s = first.trim();
  if (!s || s === "None" || s === "nan" || s === "NaN" || s === "NaT") return "";
  return s;
}

function loadParquetRows(parquetPath: string): Record<string, unknown>[] {
  const tmpDir = path.join(process.cwd(), ".tmp");
  mkdirSync(tmpDir, { recursive: true });
  const jsonPath = path.join(tmpDir, "transferencias_fic.import.json");
  const pyPath = path.join(tmpDir, "export_fic_parquet.py");
  writeFileSync(
    pyPath,
    `import duckdb, json, math, sys
parquet = sys.argv[1]
out_path = sys.argv[2]
c = duckdb.connect()
df = c.execute("SELECT * FROM read_parquet(?)", [parquet]).fetchdf()
def cell(v):
  if v is None: return None
  try:
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): return None
  except Exception:
    pass
  s = str(v).strip()
  if s in ("", "None", "nan", "NaN", "NaT"): return None
  return s
out = [{k: cell(r[k]) for k in df.columns} for _, r in df.iterrows()]
open(out_path, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
print(len(out))
`,
  );
  const n = execFileSync("python3", [pyPath, parquetPath, jsonPath], {
    encoding: "utf-8",
  }).trim();
  console.log(`Parquet → JSON: ${n} filas (${jsonPath})`);
  return JSON.parse(readFileSync(jsonPath, "utf-8")) as Record<
    string,
    unknown
  >[];
}

function mapParquetRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [src, dest] of Object.entries(PARQUET_TO_THEME)) {
    const v = cell(raw[src]);
    if (v) out[dest] = v;
  }

  const id = cell(raw.id_transferencia);
  const cdp = cell(raw.numero_cdp);
  if (id) out.id_transferencia = id;
  if (cdp) out.no_cdp = cdp;
  out.clave_seguimiento = cdp || id;
  if (cdp && id) {
    out.clave_seguimiento = `${cdp}·${id}`;
  }

  const bits = [
    cell(raw.tipo_modificacion)
      ? `Modificación: ${cell(raw.tipo_modificacion)}`
      : "",
    cell(raw.entidad_receptora)
      ? `Entidad receptora: ${cell(raw.entidad_receptora)}`
      : "",
    cell(raw.ultimo_tipo_evento_bitacora)
      ? `Bitácora (${cell(raw.fecha_ultima_bitacora) || "s/f"}): ${cell(raw.ultimo_tipo_evento_bitacora)}`
      : "",
    cell(raw.ultima_observacion_bitacora) || "",
  ].filter(Boolean);
  if (bits.length) out.observaciones = bits.join(" · ");

  const vig = cell(raw.vigencia).match(/(20\d{2})/);
  if (vig) {
    out.vigencia = vig[1];
    out.tipo_registro = `Transferencia FIC ${vig[1]}`;
    out.capa = `Transferencia FIC ${vig[1]}`;
  }

  if (!cell(out.departamento)) out.departamento = "SIN DEPARTAMENTO";
  if (!cell(out.municipio)) out.municipio = "SIN MUNICIPIO";

  return out;
}

async function main() {
  const parquetPath = process.argv[2] || DEFAULT_PARQUET;
  if (!existsSync(parquetPath)) {
    console.error("No existe el parquet:", parquetPath);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en .env.local");
    process.exit(1);
  }

  const host =
    process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] || "(sin host)";
  console.log(`DB host: ${host}`);
  if (/127\.0\.0\.1|localhost/.test(host)) {
    console.error(
      "Abortado: DATABASE_URL apunta a local. Use el pooler de Supabase UNGRD.",
    );
    process.exit(1);
  }

  // Imports dinámicos tras cargar env (evita fallback a localhost).
  const { db } = await import("../src/db");
  const { records } = await import("../src/db/schema");
  const { getTheme } = await import("../src/themes");
  const { prepareTrackingRow } = await import(
    "../src/lib/uploads/capa-inference"
  );
  const {
    insertValidatedRecords,
    ensureUser,
    upsertThemeCatalog,
  } = await import("../src/lib/records/repository");
  const { validateRow } = await import("../src/lib/validation/record-schema");
  type ValidatedRecord = import("../src/lib/validation/record-schema").ValidatedRecord;
  type RowValidationError =
    import("../src/lib/validation/record-schema").RowValidationError;

  const theme = getTheme("fic");
  if (!theme) {
    console.error("Tema fic no registrado");
    process.exit(1);
  }

  await upsertThemeCatalog(theme);
  const userId = await ensureUser({
    keycloakSub: "import-fic-parquet",
    email: "import-fic@ungrd.gov.co",
    name: "Import FIC parquet",
    role: "admin",
  });

  const rawRows = loadParquetRows(parquetPath);

  const now = new Date();
  const softDeleted = await db
    .update(records)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(records.themeId, "fic"), isNull(records.deletedAt)))
    .returning({ id: records.id });
  console.log(`Soft-delete FIC vivos: ${softDeleted.length}`);

  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];

  rawRows.forEach((raw, idx) => {
    const mapped = mapParquetRow(raw);
    if (!cell(mapped.no_cdp) && !cell(mapped.id_transferencia)) {
      errors.push({
        row: idx + 1,
        field: "no_cdp",
        message: "Sin número FIC ni id_transferencia",
      });
      return;
    }
    Object.assign(
      mapped,
      prepareTrackingRow(theme, mapped, { hint: "transferencias_fic" }),
    );
    if (cell(raw.id_transferencia)) {
      mapped.id_transferencia = cell(raw.id_transferencia);
    }
    if (cell(mapped.no_cdp) && cell(mapped.id_transferencia)) {
      mapped.clave_seguimiento = `${cell(mapped.no_cdp)}·${cell(mapped.id_transferencia)}`;
    }
    // Limpiar CDP si prepareTrackingRow reintrodujo basura
    if (mapped.no_cdp) mapped.no_cdp = cell(mapped.no_cdp);

    const result = validateRow(theme, mapped, idx + 2);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  console.log(`Validadas: ${accepted.length} · Errores: ${errors.length}`);
  if (errors.length) {
    console.log("Muestra errores:", JSON.stringify(errors.slice(0, 8), null, 2));
  }

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId: "fic",
    items: accepted,
    source: "excel",
    userId,
  });

  console.log(
    `✓ FIC parquet → Supabase: insertados=${inserted.length} duplicados_lote=${duplicates} rechazados=${errors.length}`,
  );

  writeFileSync(
    path.join(process.cwd(), ".tmp/import-fic-parquet.last.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        host,
        parquetPath,
        softDeleted: softDeleted.length,
        accepted: accepted.length,
        inserted: inserted.length,
        duplicates,
        errors: errors.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
