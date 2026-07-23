import ExcelJS from "exceljs";
import type { ThemeConfig, FormField } from "@/themes/shared/types";
import { schemaFingerprint } from "@/lib/validation/record-schema";
import { DEPARTMENTS, departmentNames } from "@/lib/geo";

function normKey(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Mapea cabeceras ArcGIS (label) o plantilla (name) → claves del tema.
 */
export function remapRowToThemeFields(
  theme: ThemeConfig,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const byName = new Map<string, FormField>();
  const byLabel = new Map<string, FormField>();
  const byNorm = new Map<string, FormField>();
  for (const f of theme.fields) {
    byName.set(f.name, f);
    byLabel.set(f.label.trim().toLowerCase(), f);
    byNorm.set(normKey(f.label), f);
    byNorm.set(normKey(f.name), f);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const k = key.trim();
    const field =
      byName.get(k) ||
      byLabel.get(k.toLowerCase()) ||
      byNorm.get(normKey(k));
    if (field) out[field.name] = value;
    else out[k] = value;
  }
  return out;
}

function sampleValue(theme: ThemeConfig, fieldName: string): string | number {
  const field = theme.fields.find((f) => f.name === fieldName);
  if (!field) return "";
  if (field.name === "departamento") return "Antioquia";
  if (field.name === "municipio") return "Medellín";
  if (field.type === "select") return field.options?.[0] || "";
  if (field.type === "number") return field.min ?? 100;
  if (field.type === "date") return "2026-07-15";
  return `Ejemplo ${field.label}`;
}

/** Genera plantilla .xlsx con dropdowns vía hoja _listas (evita límite 255 de Excel). */
export async function buildThemeTemplate(
  theme: ThemeConfig,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "UNGRD Temas Operativos";
  wb.created = new Date();

  const version = theme.schemaVersion ?? 1;
  const fingerprint = schemaFingerprint(theme);
  const depts = departmentNames();

  // Hoja de listas para validaciones largas (DIVIPOLA)
  const lists = wb.addWorksheet("_listas");
  lists.state = "hidden";
  lists.getCell("A1").value = "departamento";
  depts.forEach((name, i) => {
    lists.getCell(i + 2, 1).value = name;
  });

  // Columnas B+ para selects del tema (excluye departamento, ya en A)
  const listRanges: Record<string, string> = {
    departamento: `'_listas'!$A$2:$A$${depts.length + 1}`,
  };
  let listCol = 2;
  for (const field of theme.fields) {
    if (field.name === "departamento") continue;
    if (field.type !== "select" || !field.options?.length) continue;
    const colLetter = lists.getColumn(listCol).letter;
    lists.getCell(1, listCol).value = field.name;
    field.options.forEach((opt, i) => {
      lists.getCell(i + 2, listCol).value = opt;
    });
    listRanges[field.name] =
      `'_listas'!$${colLetter}$2:$${colLetter}$${field.options.length + 1}`;
    listCol += 1;
  }

  const cats = wb.addWorksheet("_catalogos");
  cats.state = "hidden";
  cats.addRow(["departamento", "municipio", "cod_mpio"]);
  for (const dept of DEPARTMENTS) {
    for (const m of dept.municipalities) {
      cats.addRow([dept.name, m.name, m.code]);
    }
  }

  const data = wb.addWorksheet(theme.shortName.slice(0, 28) || "Datos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = theme.fields.map((f) => f.name);
  const headerRow = data.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FF001A36" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFD100" },
  };

  theme.fields.forEach((field, idx) => {
    const col = data.getColumn(idx + 1);
    col.width = field.excelWidth ?? Math.max(14, field.label.length + 2);
    const cell = headerRow.getCell(idx + 1);
    cell.note = [
      field.label,
      `Tipo: ${field.type}`,
      field.required ? "Obligatorio" : "Opcional",
      field.name === "municipio"
        ? "Debe existir en DIVIPOLA para el departamento"
        : "",
      field.options?.length ? `Opciones: ${field.options.length}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  data.addRow(theme.fields.map((f) => sampleValue(theme, f.name)));

  const sheetWithValidation = data as ExcelJS.Worksheet & {
    dataValidations: {
      add: (range: string, validation: Record<string, unknown>) => void;
    };
  };

  for (let i = 0; i < theme.fields.length; i++) {
    const field = theme.fields[i]!;
    const colLetter = data.getColumn(i + 1).letter;
    const range = `${colLetter}2:${colLetter}1001`;

    if (listRanges[field.name]) {
      sheetWithValidation.dataValidations.add(range, {
        type: "list",
        allowBlank: !field.required,
        formulae: [listRanges[field.name]],
        showErrorMessage: true,
        errorTitle: field.label,
        error: `Seleccione un valor válido para ${field.label}`,
      });
      continue;
    }

    if (field.type === "number") {
      sheetWithValidation.dataValidations.add(range, {
        type: "decimal",
        operator: "between",
        allowBlank: !field.required,
        formulae: [field.min ?? -1e15, field.max ?? 1e15],
        showErrorMessage: true,
        errorTitle: field.label,
        error: `${field.label} debe ser numérico`,
      });
    }

    if (field.type === "date") {
      sheetWithValidation.dataValidations.add(range, {
        type: "date",
        operator: "greaterThan",
        allowBlank: !field.required,
        formulae: [new Date(2000, 0, 1)],
        showErrorMessage: true,
        errorTitle: field.label,
        error: `Use fecha válida (YYYY-MM-DD) en ${field.label}`,
      });
    }
  }

  const meta = wb.addWorksheet("_meta");
  meta.state = "veryHidden";
  meta.addRow(["theme_id", theme.id]);
  meta.addRow(["schema_version", version]);
  meta.addRow(["schema_fingerprint", fingerprint]);
  meta.addRow(["generated_at", new Date().toISOString()]);
  meta.addRow(["geo", "DIVIPOLA+MGN2024"]);

  const help = wb.addWorksheet("Instrucciones");
  help.getColumn(1).width = 96;
  help.addRow(["Plantilla UNGRD — carga masiva (paso a paso)"]);
  help.addRow([`Tema: ${theme.name} (${theme.id})`]);
  help.addRow([`Versión de schema: ${version}`]);
  help.addRow([`Huella: ${fingerprint}`]);
  help.addRow([""]);
  help.addRow(["CÓMO LLENAR (recomendado)"]);
  help.addRow([
    "1. Descargue SIEMPRE esta plantilla desde la plataforma (no reutilice archivos viejos).",
  ]);
  help.addRow([
    "2. No renombre columnas ni elimine hojas _meta / _listas / _catalogos / Instrucciones.",
  ]);
  help.addRow([
    "3. Borre la fila de ejemplo y pegue sus datos debajo del encabezado (fila 1).",
  ]);
  help.addRow([
    "4. Departamento/municipio: use las listas DIVIPOLA (hoja _catalogos).",
  ]);
  help.addRow(["5. Fechas en formato YYYY-MM-DD (ej. 2026-07-15)."]);
  help.addRow([
    "6. En la plataforma: primero «Validar sin guardar», revise el resumen, luego «Subir y guardar».",
  ]);
  help.addRow([
    "7. Si corrige datos ya cargados, active «Actualizar por clave de seguimiento» (OP/placa/CDP + capa).",
  ]);
  help.addRow([""]);
  help.addRow(["SEGUIMIENTO (MAQUETA + BITÁCORA)"]);
  help.addRow([
    "• tipo_registro y capa deben ser la misma opción (Maqueta, Bitácora, Pago, etc.).",
  ]);
  help.addRow([
    "• clave_seguimiento = OP / placa / CDP / serial / Nº declaratoria (sin sufijos tipo « / pago 1»).",
  ]);
  help.addRow([
    "• Maqueta = foto actual de la entidad. Bitácora = evento de seguimiento. Misma clave, distinta capa.",
  ]);
  help.addRow([
    "• Si deja capa vacía, la plataforma puede inferirla del nombre del archivo (ej. Bitacora.xlsx).",
  ]);
  help.addRow([
    "• Cargas semanales: use upsert. Actualiza la misma clave+capa; no duplica maqueta.",
  ]);
  help.addRow([""]);
  help.addRow(["Campos del tema:"]);
  for (const f of theme.fields) {
    help.addRow([
      `- ${f.name} (${f.label}) · ${f.type}${f.required ? " · obligatorio" : ""}`,
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

export type ParsedExcel = {
  rows: Record<string, unknown>[];
  meta: {
    themeId?: string;
    schemaVersion?: number;
    fingerprint?: string;
    /** Nombre de la hoja de datos (sirve para inferir capa). */
    sheetName?: string;
  };
};

export async function parseExcelUpload(
  buffer: ArrayBuffer | Buffer,
): Promise<ParsedExcel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);

  const metaSheet = wb.getWorksheet("_meta");
  const meta: ParsedExcel["meta"] = {};
  if (metaSheet) {
    metaSheet.eachRow((row) => {
      const key = String(row.getCell(1).value ?? "").trim();
      const val = row.getCell(2).value;
      if (key === "theme_id") meta.themeId = String(val ?? "");
      if (key === "schema_version") meta.schemaVersion = Number(val ?? 0);
      if (key === "schema_fingerprint") meta.fingerprint = String(val ?? "");
    });
  }

  const dataSheet =
    wb.worksheets.find(
      (ws) =>
        !["_meta", "_catalogos", "_listas", "Instrucciones"].includes(ws.name),
    ) || wb.worksheets[0];

  if (!dataSheet) return { rows: [], meta };

  meta.sheetName = dataSheet.name;

  const headerRow = dataSheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cell.text || cell.value || "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let empty = true;
    headers.forEach((name, col) => {
      if (!name) return;
      const cell = row.getCell(col);
      let v: unknown = cell.value;
      if (v && typeof v === "object" && "result" in (v as object)) {
        v = (v as { result: unknown }).result;
      }
      if (v instanceof Date) {
        v = v.toISOString().slice(0, 10);
      }
      if (typeof v === "string") v = v.trim();
      if (v !== null && v !== undefined && v !== "") empty = false;
      obj[name] = v ?? "";
    });
    if (!empty) rows.push(obj);
  });

  return { rows, meta };
}
