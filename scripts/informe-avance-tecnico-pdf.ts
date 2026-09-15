/**
 * Informe de avance técnico UNGRD Temas Operativos → PDF.
 *
 * Uso:
 *   npx tsx scripts/informe-avance-tecnico-pdf.ts
 *   npx tsx scripts/informe-avance-tecnico-pdf.ts docs/salida.pdf
 *
 * Lenguaje: español operativo. Persistencia: PostgreSQL (no nombrar marcas de hosting).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { jsPDF } from "jspdf";
import {
  drawUngrdHeader,
  ensureSpace,
  PDF_MARGIN,
  PDF_MUTED,
  PDF_NAVY,
  PDF_NAVY_DEEP,
  PDF_TEXT,
  PDF_YELLOW,
  stampFooters,
} from "../src/lib/pdf/brand";
import { THEMES } from "../src/themes";

const OUT_DEFAULT = join(
  process.cwd(),
  "docs",
  "INFORME-AVANCE-TECNICO-UNGRD-TEMAS-OPERATIVOS.pdf",
);

const M = PDF_MARGIN;
const NAVY = PDF_NAVY;
const MUTED = PDF_MUTED;
const TEXT = PDF_TEXT;

type Doc = jsPDF;

function pageW(doc: Doc) {
  return doc.internal.pageSize.getWidth();
}
function contentW(doc: Doc) {
  return pageW(doc) - M * 2;
}

function h1(doc: Doc, y: number, title: string): number {
  y = ensureSpace(doc, y, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(title, M, y);
  y += 2;
  doc.setDrawColor(...PDF_YELLOW);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + 42, y);
  return y + 6;
}

function h2(doc: Doc, y: number, title: string): number {
  y = ensureSpace(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(title, M, y);
  return y + 5;
}

function para(doc: Doc, y: number, text: string, size = 9): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...TEXT);
  const lines = doc.splitTextToSize(text, contentW(doc));
  for (const line of lines) {
    y = ensureSpace(doc, y, 5);
    doc.text(line, M, y);
    y += 4.2;
  }
  return y + 2;
}

function bullet(doc: Doc, y: number, items: string[]): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  for (const item of items) {
    const lines = doc.splitTextToSize(`•  ${item}`, contentW(doc));
    for (let i = 0; i < lines.length; i++) {
      y = ensureSpace(doc, y, 5);
      doc.text(lines[i], M, y);
      y += 4.1;
    }
    y += 0.6;
  }
  return y + 2;
}

function table(
  doc: Doc,
  y: number,
  headers: string[],
  rows: string[][],
  colWeights?: number[],
): number {
  const w = contentW(doc);
  const weights = colWeights || headers.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((wt) => (wt / sum) * w);
  const rowH = 6.2;

  const drawRow = (cells: string[], header: boolean) => {
    y = ensureSpace(doc, y, rowH + 2);
    let x = M;
    if (header) {
      doc.setFillColor(...NAVY);
      doc.rect(M, y - 4, w, rowH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setDrawColor(220, 226, 232);
      doc.setLineWidth(0.2);
      doc.line(M, y + 2, M + w, y + 2);
      doc.setTextColor(...TEXT);
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(8);
    for (let i = 0; i < cells.length; i++) {
      const cell = doc.splitTextToSize(String(cells[i] ?? ""), widths[i] - 2);
      doc.text(cell[0] || "", x + 1, y);
      x += widths[i];
    }
    y += rowH;
  };

  drawRow(headers, true);
  for (const r of rows) drawRow(r, false);
  return y + 4;
}

/** Caja de pipeline / diagrama. */
function box(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  fill: [number, number, number] = [232, 238, 244],
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  const lines = doc.splitTextToSize(label, w - 3);
  const ty = y + h / 2 - ((lines.length - 1) * 2.6) / 2 + 1.2;
  doc.text(lines, x + w / 2, ty, { align: "center" });
}

function arrowRight(doc: Doc, x1: number, yMid: number, x2: number) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.45);
  doc.line(x1, yMid, x2 - 1.5, yMid);
  doc.setFillColor(...NAVY);
  doc.triangle(x2, yMid, x2 - 2.2, yMid - 1.2, x2 - 2.2, yMid + 1.2, "F");
}

function arrowDown(doc: Doc, xMid: number, y1: number, y2: number) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.45);
  doc.line(xMid, y1, xMid, y2 - 1.5);
  doc.setFillColor(...NAVY);
  doc.triangle(xMid, y2, xMid - 1.2, y2 - 2.2, xMid + 1.2, y2 - 2.2, "F");
}

async function build(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generatedAt = new Date();
  const themesOperativos = THEMES.filter((t) => t.id !== "plantilla");

  // ── Portada ──────────────────────────────────────────────
  let y = await drawUngrdHeader(doc, {
    title: "Informe de avance técnico",
    subtitle: "UNGRD · Temas Operativos",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "Documento de seguimiento del desarrollo de la plataforma de captura, validación, almacenamiento y analítica operativa de la Unidad Nacional para la Gestión del Riesgo de Desastres (UNGRD).",
  );
  y = para(
    doc,
    y,
    "Alcance del informe: arquitectura, modelo de datos en PostgreSQL, organización por temas, formularios de captura, pipelines de carga, analítica, mapas y estado del trabajo reciente (incluido FIC).",
  );

  y = h2(doc, y, "Datos del documento");
  y = table(
    doc,
    y,
    ["Campo", "Valor"],
    [
      ["Producto", "UNGRD Temas Operativos"],
      ["Tipo", "Informe de avance técnico de desarrollo"],
      ["Stack", "Next.js · TypeScript · PostgreSQL · Drizzle ORM"],
      ["Auth", "Auth.js (modo demo o Keycloak OIDC)"],
      ["Despliegue piloto", "Vercel · app web en /app"],
      ["Fecha de corte", generatedAt.toISOString().slice(0, 10)],
    ],
    [1, 2.4],
  );

  y = h2(doc, y, "Contenido");
  y = bullet(doc, y, [
    "1. Qué es la plataforma y qué problema resuelve",
    "2. Arquitectura lógica y flujo de datos",
    "3. PostgreSQL: tablas principales",
    "4. Temas: carpetas, contrato y catálogo",
    "5. Formularios de captura y capas",
    "6. Pipelines: Excel, formulario y carga masiva",
    "7. Analítica, mapa y reportes",
    "8. Avance reciente: FIC",
    "9. Verificación y estado",
  ]);

  // ── 1. Producto ──────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "1. Producto",
    subtitle: "Qué es y para qué sirve",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "La plataforma concentra, por tema operativo, la captura de registros (formulario o Excel), la validación geográfica con DIVIPOLA, el almacenamiento en PostgreSQL y la consulta analítica (mapa, filtros, tablero de decisión y reportes PDF).",
  );
  y = para(
    doc,
    y,
    "Antes: prototipo con datos en memoria del navegador. Ahora: aplicación con base PostgreSQL, control de acceso por rol y tema, versionado de ediciones y carga desde bases oficiales.",
  );

  y = h2(doc, y, "Usuarios y pantallas");
  y = bullet(doc, y, [
    "Captura: formularios por capa (alta, seguimiento, eventos append).",
    "Registros: vista tipo Excel (Maqueta) y seguimiento por formulario.",
    "Analítica: filtros, mapa MGN/DIVIPOLA, gráficos, tabla operativa.",
    "Cargas: plantilla Excel, dry-run, upsert por clave + capa.",
    "Centro de mando nacional: semáforos y deep-links a cada tema.",
  ]);

  y = h2(doc, y, "Principios de diseño aplicados");
  y = bullet(doc, y, [
    "Un tema = una carpeta src/themes/<slug>/ (sin mezclar lógica entre temas).",
    "Municipios y departamentos solo desde DIVIPOLA / MGN oficiales.",
    "Persistencia de negocio en PostgreSQL (no localStorage).",
    "Clave de seguimiento + capa (tipo_registro) para upsert y cruces.",
    "Auth open source: Auth.js + Keycloak (sin Clerk).",
  ]);

  // ── 2. Arquitectura ──────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "2. Arquitectura",
    subtitle: "Capas y flujo",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "Monolito Next.js (App Router): la UI y los Route Handlers viven en el mismo repositorio. La API orquesta auth, validación y acceso a PostgreSQL vía Drizzle.",
  );

  y = h2(doc, y, "Diagrama de capas");
  y = ensureSpace(doc, y, 52);
  const bw = 40;
  const bh = 14;
  const gap = 8;
  const startX = M;
  const row1 = y;
  box(doc, startX, row1, bw, bh, "UI\nNext.js / React");
  arrowRight(doc, startX + bw, row1 + bh / 2, startX + bw + gap);
  box(doc, startX + bw + gap, row1, bw, bh, "API\n/api/themes/*");
  arrowRight(
    doc,
    startX + 2 * bw + gap,
    row1 + bh / 2,
    startX + 2 * bw + 2 * gap,
  );
  box(
    doc,
    startX + 2 * bw + 2 * gap,
    row1,
    bw + 6,
    bh,
    "Dominio\nlib + themes",
  );
  y = row1 + bh + 6;
  arrowDown(doc, startX + 2 * bw + 2 * gap + (bw + 6) / 2, row1 + bh, y);
  box(
    doc,
    startX + 2 * bw + 2 * gap - 4,
    y,
    bw + 14,
    bh,
    "PostgreSQL\nDrizzle ORM",
  );
  y += bh + 4;
  box(doc, M, y, 55, bh, "Geo estático\nDIVIPOLA + MGN");
  box(doc, M + 62, y, 55, bh, "Identidad\nAuth.js / Keycloak");
  y += bh + 8;

  y = table(
    doc,
    y,
    ["Capa", "Ruta", "Rol"],
    [
      ["UI", "src/app, src/components", "Captura, analítica, admin"],
      ["API", "src/app/api", "HTTP, authz, orquestación"],
      ["Dominio", "src/lib", "Excel, Zod, geo, repositorios"],
      ["Temas", "src/themes/<slug>", "Schema y formularios de negocio"],
      ["DB", "src/db", "Schema Drizzle + seed"],
      ["Geo", "data/, public/geo", "DIVIPOLA y polígonos MGN"],
    ],
    [1, 1.6, 2],
  );

  y = h2(doc, y, "Flujo de datos (resumen)");
  y = ensureSpace(doc, y, 36);
  const fy = y;
  const fw = 28;
  box(doc, M, fy, fw, 12, "Form / Excel");
  arrowRight(doc, M + fw, fy + 6, M + fw + 6);
  box(doc, M + fw + 6, fy, fw + 4, 12, "Zod +\nDIVIPOLA");
  arrowRight(doc, M + 2 * fw + 10, fy + 6, M + 2 * fw + 16);
  box(doc, M + 2 * fw + 16, fy, fw + 2, 12, "records\nPostgreSQL");
  arrowRight(doc, M + 3 * fw + 18, fy + 6, M + 3 * fw + 24);
  box(doc, M + 3 * fw + 24, fy, fw + 8, 12, "Mapa /\nAnalítica / PDF");
  y = fy + 18;

  y = para(
    doc,
    y,
    "Cada escritura deja traza en audit_log. Las ediciones generan filas en record_versions. Las cargas masivas quedan en uploads (aceptados, rechazados, duplicados, errores).",
  );

  // ── 3. PostgreSQL ────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "3. PostgreSQL",
    subtitle: "Tablas de la aplicación",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "La base operativa usa PostgreSQL. El acceso desde la app es Drizzle ORM. En producción la instancia puede alojarse en un proveedor gestionado; el contrato de datos es SQL estándar sobre estas tablas.",
  );

  y = h2(doc, y, "Tablas principales (schema public)");
  y = table(
    doc,
    y,
    ["Tabla", "Contenido"],
    [
      ["themes", "Catálogo de temas + field_schema versionado"],
      ["records", "Filas operativas: fijos + payload jsonb"],
      ["record_versions", "Historial de ediciones por registro"],
      ["uploads", "Meta de cargas Excel y errores"],
      ["users", "Usuario (OIDC/demo) y rol de aplicación"],
      ["user_theme_access", "ACL lectura/escritura por tema"],
      ["audit_log", "Acciones auditables"],
    ],
    [1.2, 2.8],
  );

  y = h2(doc, y, "Tabla records (detalle)");
  y = bullet(doc, y, [
    "Columnas fijas: theme_id, departamento, municipio, fecha, estado, valor.",
    "payload (jsonb): resto de campos del tema (CDP, plazos, OP, placa, etc.).",
    "content_hash: evita duplicados exactos por tema.",
    "source: origen (form, excel, import, …).",
    "deleted_at: soft-delete (las consultas vivas filtran nulos).",
    "Índices por tema+fecha, tema+departamento, tema+estado.",
  ]);

  y = h2(doc, y, "Capa de lectura analítica (vistas SQL)");
  y = para(
    doc,
    y,
    "Para el equipo de datos se generan vistas por tema/capa (p. ej. fic.transferencia, agua.general) a partir de records.payload. Sirven a BI y consultas SQL; la captura sigue escribiendo en public.records.",
  );

  y = h2(doc, y, "Diagrama entidad (simplificado)");
  y = ensureSpace(doc, y, 48);
  const ey = y;
  box(doc, M, ey, 36, 16, "themes\nid PK");
  box(doc, M + 50, ey, 42, 16, "records\ntheme_id FK");
  box(doc, M + 108, ey, 42, 16, "record_versions\nrecord_id FK");
  arrowRight(doc, M + 36, ey + 8, M + 50);
  arrowRight(doc, M + 92, ey + 8, M + 108);
  y = ey + 22;
  box(doc, M, y, 36, 14, "users");
  box(doc, M + 50, y, 42, 14, "uploads\ntheme_id FK");
  box(doc, M + 108, y, 42, 14, "user_theme_access");
  y += 20;

  // ── 4. Temas ─────────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "4. Temas",
    subtitle: "Organización del monorepo",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "Cada tema es autónomo bajo src/themes/<slug>/. El contrato es ThemeConfig (theme.ts): campos, formularios, etiquetas y reglas. El núcleo (components/lib/app) no se modifica salvo arquitectura acordada.",
  );

  y = h2(doc, y, "Archivos típicos de un tema");
  y = table(
    doc,
    y,
    ["Archivo", "Función"],
    [
      ["theme.ts", "Config exportada (campos + captureForms)"],
      ["fields-from-source.ts", "Campos alineados al Excel oficial"],
      ["capture-forms.ts", "Formularios, capas, modos, calculados"],
      ["select-options.ts", "Listas cerradas (si aplica)"],
      ["README.md", "Documentación del tema"],
      ["*sync.ts", "Sincroniza maqueta/inventario desde eventos"],
    ],
    [1.4, 2.6],
  );

  y = h2(doc, y, "Catálogo registrado");
  const themeRows = themesOperativos.map((t) => [
    t.id,
    t.shortName || t.name,
    String(t.schemaVersion ?? 1),
    String(t.captureForms?.length ?? 0),
  ]);
  y = table(
    doc,
    y,
    ["Slug", "Nombre", "Schema", "Forms"],
    themeRows,
    [1.6, 1.6, 0.7, 0.7],
  );

  y = para(
    doc,
    y,
    `Total temas operativos (sin plantilla): ${themesOperativos.length}. La carpeta plantilla/ es línea base congelada para copiar al crear un tema nuevo.`,
  );

  y = h2(doc, y, "Temas con trabajo multi-capa más maduro");
  y = bullet(doc, y, [
    "Agua y Saneamiento — maqueta + bitácora, pagos, mods, CDP/RC (piloto contractual).",
    "Puentes — estructuración → inventario → bitácora (contrato raíz).",
    "Banco de maquinaria — convenio raíz + detalle por serial.",
    "Carrotanques — maqueta por placa + bitácora/suministro.",
    "FIC — transferencia / legalización / prórroga por vigencia.",
    "Obras de emergencia e impuestos — captura + indicadores IRP/SPI.",
  ]);

  // ── 5. Formularios ───────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "5. Formularios",
    subtitle: "Captura por capa",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "CapturePanel lee captureForms del tema. Cada formulario declara: id, etiqueta, capa, modo (create-once / upsert / append), campos visibles, obligatorios, solo lectura al editar, y campos calculados.",
  );

  y = h2(doc, y, "Modos de persistencia");
  y = table(
    doc,
    y,
    ["Modo", "Comportamiento"],
    [
      ["create-once", "Alta única; si ya existe la capa+clave → conflicto"],
      ["upsert", "Actualiza la fila vigente de esa capa+clave"],
      ["append", "Inserta evento (bitácora, pago, prórroga…)"],
    ],
    [1, 3],
  );

  y = h2(doc, y, "Lookups");
  y = bullet(doc, y, [
    "Orden de proveeduría (Agua y afines): precarga desde Alta/Maqueta.",
    "Puente / proceso: cadena contrato → inventario → bitácora.",
    "FIC: búsqueda por número FIC (campo técnico no_cdp) en todas las vigencias.",
    "Serial / convenio (Banco), placa (Carrotanques).",
  ]);

  y = h2(doc, y, "Campos calculados (ejemplos)");
  y = bullet(doc, y, [
    "FIC: plazo_final = plazo_inicial + adición; fecha_final = fecha_inicial + plazo_final.",
    "FIC: % avance = (desembolso − por legalizar) / desembolso × 100.",
    "Obras: SPI / CPI / IRP a partir de fechas y avances de la base.",
  ]);

  y = h2(doc, y, "Flujo de captura en pantalla");
  y = ensureSpace(doc, y, 40);
  const cy = y;
  box(doc, M, cy, 32, 12, "Elegir\nformulario");
  arrowRight(doc, M + 32, cy + 6, M + 38);
  box(doc, M + 38, cy, 32, 12, "Lookup\n(si aplica)");
  arrowRight(doc, M + 70, cy + 6, M + 76);
  box(doc, M + 76, cy, 32, 12, "Editar\ncampos");
  arrowRight(doc, M + 108, cy + 6, M + 114);
  box(doc, M + 114, cy, 36, 12, "POST/PATCH\nAPI + versión");
  y = cy + 18;

  // ── 6. Pipelines ─────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "6. Pipelines de datos",
    subtitle: "Excel, formulario e importaciones",
    generatedAt,
  });

  y = h2(doc, y, "Pipeline Excel (carga masiva)");
  y = ensureSpace(doc, y, 44);
  let px = M;
  const py = y;
  const steps = [
    "Plantilla\nExcelJS",
    "Parse\nfilas",
    "Inferir\ncapa",
    "Zod +\nDIVIPOLA",
    "Upsert /\ninsert",
    "uploads +\naudit",
  ];
  for (let i = 0; i < steps.length; i++) {
    box(doc, px, py, 26, 14, steps[i]);
    if (i < steps.length - 1) arrowRight(doc, px + 26, py + 7, px + 30);
    px += 30;
  }
  y = py + 20;
  y = para(
    doc,
    y,
    "Ruta: POST /api/themes/:slug/uploads. Soporta dry-run (validar sin guardar). Inferencia de capa por nombre de hoja/archivo (capa-inference). Duplicados por content_hash o por clave+capa en modo actualizar.",
  );

  y = h2(doc, y, "Pipeline formulario");
  y = bullet(doc, y, [
    "UI → prepareTrackingRow (capa, clave, normalizaciones del tema).",
    "validateRow (Zod + DIVIPOLA).",
    "insert / upsert / append según mode del formulario.",
    "Sync de maqueta/inventario cuando el tema lo define (última fila vigente).",
    "Versionado si es edición de un registro existente.",
  ]);

  y = h2(doc, y, "Importaciones especiales");
  y = table(
    doc,
    y,
    ["Script / origen", "Tema", "Notas"],
    [
      ["import-fic-parquet.ts", "FIC", "Parquet AppSheet → records (388 filas)"],
      ["reimport-puentes.ts", "Puentes", "Excel + orden estructuración→inventario"],
      ["reimport-agua-bitacora.ts", "Agua", "Bitácora y sync maqueta"],
      ["Bases ArcGIS / Excel", "Obras, etc.", "fields-from-source alineado al archivo"],
    ],
    [1.5, 0.9, 2],
  );

  y = h2(doc, y, "Anti-duplicados y calidad");
  y = bullet(doc, y, [
    "Hash de contenido por tema.",
    "Upsert por clave_seguimiento + capa.",
    "Soft-delete de filas de prueba/seed en limpiezas admin.",
    "Harness y smoke locales contra la API con sesión.",
  ]);

  // ── 7. Analítica ─────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "7. Analítica y reportes",
    subtitle: "Tablero, mapa y PDF",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "AnalyticsPanel combina agregación en cliente sobre los records cargados y verificación SQL (/api/themes/:slug/analytics). Los filtros viven en la URL (compartibles).",
  );

  y = h2(doc, y, "Componentes");
  y = table(
    doc,
    y,
    ["Pieza", "Función"],
    [
      ["RecordFilterBar", "Texto, territorio, estado, capa, fechas, CDP/RC (FIC)"],
      ["DecisionDashboard", "KPIs, semáforo, alertas, tabla operativa"],
      ["ColombiaMap", "Coropleta departamentos/municipios (MGN + DIVIPOLA)"],
      ["RecordsDataTable", "Tabla filtrada + Excel de descarga"],
      ["NationalCommandCenter", "Vista cruzada de temas"],
      ["themeBriefingPdf", "PDF con branding UNGRD por tema"],
    ],
    [1.3, 2.7],
  );

  y = h2(doc, y, "Geo");
  y = bullet(doc, y, [
    "data/divipola.json — catálogo oficial de municipios.",
    "public/geo/departamentos-mgn2024.json — polígonos para el mapa.",
    "No se inventan códigos ni nombres de municipio.",
  ]);

  y = h2(doc, y, "Flujo analítico");
  y = ensureSpace(doc, y, 34);
  const ay = y;
  box(doc, M, ay, 34, 12, "Records\nen memoria");
  arrowRight(doc, M + 34, ay + 6, M + 40);
  box(doc, M + 40, ay, 34, 12, "Filtros\nURL");
  arrowRight(doc, M + 74, ay + 6, M + 80);
  box(doc, M + 80, ay, 34, 12, "Brief +\nmapa");
  arrowRight(doc, M + 114, ay + 6, M + 120);
  box(doc, M + 120, ay, 34, 12, "PDF /\nExcel");
  y = ay + 18;

  // ── 8. FIC ───────────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "8. Avance reciente: FIC",
    subtitle: "Transferencias Fondo de Inversión Colectiva",
    generatedAt,
  });

  y = para(
    doc,
    y,
    "El tema fic concentra el seguimiento de transferencias. Capas = vigencia (Transferencia FIC 2014…2026). Clave operativa: número FIC (campo técnico no_cdp). Datos cargados desde parquet AppSheet CONTROL FIC: 388 registros vivos en PostgreSQL.",
  );

  y = h2(doc, y, "Formularios FIC");
  y = table(
    doc,
    y,
    ["Formulario", "Uso"],
    [
      ["1 · Transferencia FIC", "Alta: acto, formato de aprobación, plazos, CDP/RC, valores"],
      ["2 · Seguimiento legalización", "Estado, valores legalizados, visitas"],
      ["3 · Modificación / prórroga", "Adición de plazo; recalcula plazo y fecha final"],
    ],
    [1.3, 2.7],
  );

  y = h2(doc, y, "Campos de plazos (misma fila)");
  y = table(
    doc,
    y,
    ["Campo", "Significado"],
    [
      ["plazo_ejecucion_dias", "Plazo inicial (se conserva)"],
      ["plazo_adicion_dias", "Días de prórroga"],
      ["plazo_final_dias", "Inicial + adición (calculado)"],
      ["fecha_inicial_para_legalizacion", "Fecha de inicio del conteo"],
      ["fecha_final_para_legalizacion", "Inicial + plazo final (calculado)"],
      ["formato_de_aprobacion_de_la_atencion", "Texto del formato de aprobación"],
      ["fecha_formato_de_aprobacion_de_la_atencion", "Fecha del formato"],
    ],
    [1.8, 2.2],
  );

  y = h2(doc, y, "Tablero FIC");
  y = bullet(doc, y, [
    "KPIs: desembolsado, por legalizar, legalizado, vencidos.",
    "Tabla operativa blanca: Nº CDP, Nº RC, acto admin., desembolso, % avance.",
    "Filtros: CDP, RC, fechas de acto administrativo, vigencia, territorio, estado.",
    "Identidad de producto: FIC (no «orden de proveeduría»).",
  ]);

  y = h2(doc, y, "Pipeline FIC (importación)");
  y = ensureSpace(doc, y, 32);
  const iy = y;
  box(doc, M, iy, 36, 12, "Parquet\nAppSheet");
  arrowRight(doc, M + 36, iy + 6, M + 42);
  box(doc, M + 42, iy, 40, 12, "Mapeo columnas\n→ payload FIC");
  arrowRight(doc, M + 82, iy + 6, M + 88);
  box(doc, M + 88, iy, 36, 12, "Soft-delete\nanterior");
  arrowRight(doc, M + 124, iy + 6, M + 130);
  box(doc, M + 130, iy, 32, 12, "INSERT\n388 filas");
  y = iy + 18;

  // ── 9. Estado ────────────────────────────────────────────
  doc.addPage();
  y = await drawUngrdHeader(doc, {
    title: "9. Verificación y estado",
    subtitle: "Cómo se comprueba y qué sigue",
    generatedAt,
  });

  y = h2(doc, y, "Comandos de verificación");
  y = table(
    doc,
    y,
    ["Comando", "Qué cubre"],
    [
      ["npm run harness", "Suite de pruebas de API/dominio"],
      ["npm run smoke", "Humos con servidor local"],
      ["npm run test:unit", "Pruebas unitarias de pipeline/filtros"],
      ["graphify update .", "Grafo de dependencias del código"],
    ],
    [1.3, 2.7],
  );

  y = h2(doc, y, "Estado al corte");
  y = bullet(doc, y, [
    "MVP operable: captura + Excel + PostgreSQL + analítica + mapa.",
    "Piloto web desplegado; tema Agua como referencia contractual.",
    "FIC con base cargada, formularios y tablero operativo.",
    "Temas multi-capa (Puentes, Banco, Carrotanques, Agua) con sync.",
    "Reportes PDF institucionales y filtros compartibles por URL.",
  ]);

  y = h2(doc, y, "Riesgos / deuda conocida (resumen)");
  y = bullet(doc, y, [
    "Uploads en filesystem local (no object storage aún).",
    "Keycloak requiere contenedor Docker en entornos que lo usen.",
    "Polígonos municipales completos no embebidos (peso).",
    "Algunos schemas de plataforma (workflow) aún en evolución frente al legacy public.",
  ]);

  y = h2(doc, y, "Glosario breve");
  y = table(
    doc,
    y,
    ["Término", "Definición"],
    [
      ["Tema", "Módulo de negocio con schema y formularios propios"],
      ["Capa", "tipo_registro / hoja (vigencia, bitácora, alta…)"],
      ["Clave", "Identificador de seguimiento (FIC, OP, placa, puente…)"],
      ["Maqueta", "Fila consolidada vigente alimentada por satélites"],
      ["payload", "JSON en records con campos específicos del tema"],
      ["DIVIPOLA", "Catálogo oficial DANE de municipios"],
    ],
    [1, 3],
  );

  y = h2(doc, y, "Cierre");
  y = para(
    doc,
    y,
    "Este informe describe el sistema tal como está implementado en el repositorio: capas de software, tablas PostgreSQL, contrato de temas, formularios, pipelines y el avance del tema FIC. Sirve como evidencia de avance técnico para supervisión y continuidad del desarrollo.",
  );

  stampFooters(
    doc,
    "UNGRD · Temas Operativos · Informe de avance técnico · uso interno",
  );

  return doc;
}

async function main() {
  const out = resolve(process.argv[2] || OUT_DEFAULT);
  await mkdir(dirname(out), { recursive: true });
  const doc = await build();
  const ab = doc.output("arraybuffer");
  await writeFile(out, Buffer.from(ab));
  console.log(`PDF escrito: ${out}`);
  console.log(`Páginas: ${doc.getNumberOfPages()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
