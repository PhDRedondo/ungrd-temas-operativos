/**
 * Importa un Excel ArcGIS real a un tema (prueba oficial Supabase).
 *
 * Uso:
 *   npx tsx scripts/import-source-file.ts puentes "/Users/.../CONSOLIDADO DE PUENTES....xlsx" PUENTES
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import * as XLSX from "xlsx";
import { getTheme } from "../src/themes";
import { remapRowToThemeFields } from "../src/lib/excel/template";
import {
  insertValidatedRecords,
  upsertThemeCatalog,
  ensureUser,
} from "../src/lib/records/repository";
import {
  validateRow,
  type RowValidationError,
  type ValidatedRecord,
} from "../src/lib/validation/record-schema";

function parseSheet(
  filePath: string,
  sheetHint?: string,
): Record<string, unknown>[] {
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName =
    (sheetHint &&
      wb.SheetNames.find((n) =>
        n.toLowerCase().includes(sheetHint.toLowerCase()),
      )) ||
    wb.SheetNames.find(
      (n) => !/municipio|datos|lista|backup|^hoja/i.test(n),
    ) ||
    wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName]!;
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  console.log(`Hoja "${sheetName}": ${json.length} filas`);
  return json;
}

async function main() {
  const themeId = process.argv[2];
  const filePath = process.argv[3];
  const sheetHint = process.argv[4];
  if (!themeId || !filePath) {
    console.error(
      "Uso: npx tsx scripts/import-source-file.ts <themeId> <xlsxPath> [sheetHint]",
    );
    process.exit(1);
  }

  const theme = getTheme(themeId);
  if (!theme) {
    console.error("Tema no encontrado:", themeId);
    process.exit(1);
  }

  await upsertThemeCatalog(theme);
  const userId = await ensureUser({
    keycloakSub: "import-script",
    email: "import@ungrd.gov.co",
    name: "Importador",
    role: "admin",
  });

  const rawRows = parseSheet(filePath, sheetHint);
  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];

  const defaultTipo: Record<string, string> = {
    "obras-de-emergencia": sheetHint?.toLowerCase().includes("o.p")
      ? "Orden de proveeduría"
      : "Contrato de obra",
    carrotanques: /suministro/i.test(sheetHint || "")
      ? "Suministro / viajes"
      : /bitacora/i.test(sheetHint || "")
        ? "Bitácora estado"
        : "Maqueta / inventario",
    "agua-y-saneamiento": /pago/i.test(sheetHint || "")
      ? "Pago / desembolso"
      : /bitacora/i.test(sheetHint || "")
        ? "Bitácora estado"
        : /modific/i.test(sheetHint || "")
          ? "Modificación contractual"
          : /control/i.test(sheetHint || "")
            ? "Control ejecución física"
            : "Maqueta / orden",
    "banco-de-maquinaria": /convenio/i.test(sheetHint || "")
      ? "Convenio o proceso"
      : /entrega/i.test(sheetHint || "")
        ? "Entrega a beneficiario"
        : /bitacora/i.test(sheetHint || "")
          ? "Bitácora convenio"
          : "Maqueta / inventario",
    puentes: "Inventario puente",
    "obras-por-impuestos": "Convenio obra por impuesto",
    "declaratoria-de-emergencia": "Decreto / declaratoria",
  };

  rawRows.forEach((raw, idx) => {
    const mapped = remapRowToThemeFields(theme, raw);
    if (
      theme.fields.some((f) => f.name === "tipo_registro") &&
      (!mapped.tipo_registro || String(mapped.tipo_registro).trim() === "")
    ) {
      mapped.tipo_registro = defaultTipo[themeId] || "Registro";
    }
    if (
      theme.fields.some((f) => f.name === "capa") &&
      (!mapped.capa || String(mapped.capa).trim() === "")
    ) {
      mapped.capa = mapped.tipo_registro || defaultTipo[themeId] || "Registro";
    }

    // Bitácoras/pagos a menudo no traen geo: no descartar filas de seguimiento
    const hasKey = [
      mapped.orden_de_proveeduria,
      mapped.placa,
      mapped.serial,
      mapped.no_convenio,
      mapped.clave_seguimiento,
      mapped.id,
    ].some((v) => v != null && String(v).trim() !== "");
    const hasDept =
      mapped.departamento && String(mapped.departamento).trim() !== "";
    if (!hasDept && !hasKey) return;
    if (!hasDept) mapped.departamento = "SIN DEPARTAMENTO";

    // Forzar clave de seguimiento antes de validar
    if (
      !mapped.clave_seguimiento ||
      String(mapped.clave_seguimiento).trim() === ""
    ) {
      const key = [
        mapped.orden_de_proveeduria,
        mapped.placa,
        mapped.serial,
        mapped.no_maquina,
        mapped.no_convenio,
        mapped.contrato_de_obra,
        mapped.no_declaratoria,
        mapped.id,
      ].find((v) => v != null && String(v).trim() !== "");
      if (key != null) mapped.clave_seguimiento = String(key).trim();
    }

    const result = validateRow(theme, mapped, idx + 2);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  console.log(`Validadas: ${accepted.length} · Errores: ${errors.length}`);
  if (errors.length) {
    console.log("Muestra errores:", JSON.stringify(errors.slice(0, 5), null, 2));
  }

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId,
    items: accepted,
    source: "excel",
    userId,
  });

  console.log(
    `✓ Import ${themeId}: insertados=${inserted.length} duplicados=${duplicates} rechazados=${errors.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
