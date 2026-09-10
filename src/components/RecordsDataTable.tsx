"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MapPin,
  Search,
  Table2,
} from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, formatNumber, type RecordRow } from "@/lib/data";
import { isSourceTheme } from "@/lib/analytics/decision";
import { previewColumnsForTheme } from "@/lib/analytics/enrichRecords";
import { matchRecordQuery } from "@/lib/analytics/recordFilters";
import { downloadAoaXlsx } from "@/lib/excel/download-aoa";

const RecordDetailModal = dynamic(
  () =>
    import("./RecordDetailModal").then((m) => m.RecordDetailModal),
  { ssr: false },
);

const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Anchos mínimos para que CDP/RC/acto/% no queden aplastados con table-auto + scroll. */
const COL_MIN_WIDTH: Record<string, string> = {
  no_cdp: "9rem",
  no_rc: "8rem",
  fecha_acto_administrativo_resolucion: "11rem",
  fecha: "10rem",
  porcentaje_de_avance_en_el_ejericicio_de_legalizacion: "9rem",
  departamento: "9rem",
  municipio: "9rem",
  estado: "8rem",
  valor: "9rem",
  valor_por_legalizar: "9rem",
  vigencia: "5.5rem",
  plazo_ejecucion_dias: "7rem",
  plazo_adicion_dias: "7rem",
  plazo_final_dias: "7rem",
  fecha_inicial_para_legalizacion: "10rem",
  fecha_final_para_legalizacion: "10rem",
};

const FIC_STICKY_KEYS = ["no_cdp", "no_rc"] as const;

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
};

function cellValue(row: RecordRow, key: string) {
  const v = row[key];
  if (v === undefined || v === null) return "";
  return v;
}

function displayCellText(raw: string | number) {
  const text = String(raw ?? "").trim();
  return text || "—";
}

export function RecordsDataTable({ theme, records }: Props) {
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [tableQuery, setTableQuery] = useState("");

  const isFic = theme.id === "fic";
  const columns = useMemo(
    () => previewColumnsForTheme(theme.id),
    [theme.id],
  );
  const source = isSourceTheme(theme.id);
  const stickyLeftByKey = useMemo(() => {
    if (!isFic) return new Map<string, string>();
    const map = new Map<string, string>();
    let leftPx = 0;
    for (const key of FIC_STICKY_KEYS) {
      if (!columns.some((c) => c.key === key)) continue;
      map.set(key, `${leftPx}px`);
      const rem = Number.parseFloat(COL_MIN_WIDTH[key] || "8") || 8;
      leftPx += rem * 16;
    }
    return map;
  }, [columns, isFic]);

  const visible = useMemo(
    () =>
      tableQuery.trim()
        ? records.filter((r) => matchRecordQuery(r, tableQuery))
        : records,
    [records, tableQuery],
  );

  useEffect(() => {
    setPage(0);
  }, [records, tableQuery]);

  const total = visible.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, pageCount - 1);

  const pageRows = useMemo(() => {
    const start = safePage * pageSize;
    return visible.slice(start, start + pageSize);
  }, [visible, safePage, pageSize]);

  function changePageSize(n: (typeof PAGE_SIZES)[number]) {
    setPageSize(n);
    setPage(0);
  }

  async function downloadExcel() {
    const headers = theme.fields.map((f) => f.name);
    const withId = ["id", ...headers.filter((h) => h !== "id")];
    const rows = visible.map((r) =>
      withId.map((h) => (r[h] === undefined ? "" : r[h])),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadAoaXlsx(
      [{ name: theme.shortName.slice(0, 28), rows: [withId, ...rows] }],
      `${theme.id}_filtrados_${stamp}.xlsx`,
    );
  }

  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  function renderCell(row: RecordRow, key: string, kind?: string) {
    const raw = cellValue(row, key);
    if (kind === "money") {
      return formatCop(Number(raw || 0));
    }
    if (kind === "badge") {
      return (
        <span className="inline-block max-w-full truncate rounded-full bg-ungrd-bg px-2 py-0.5 text-xs font-bold text-ungrd-heading">
          {displayCellText(raw as string | number)}
        </span>
      );
    }
    const text = displayCellText(raw as string | number);
    if (/^sin (departamento|municipio)$/i.test(text)) {
      return <span className="text-ungrd-muted">Sin dato en capa</span>;
    }
    return text;
  }

  return (
    <section className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 xl:col-span-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
            <Table2 className="h-4 w-4 shrink-0 text-ungrd-navy" />
            <span className="truncate">
              {isFic
                ? "Tabla operativa FIC"
                : source
                  ? "Expedientes · base filtrada"
                  : "Registros · base filtrada"}
            </span>
          </h3>
          <p className="mt-1 text-xs text-ungrd-muted">
            {formatNumber(total)} registro{total === 1 ? "" : "s"}
            {tableQuery.trim()
              ? ` (de ${formatNumber(records.length)} en filtro del panel)`
              : " según filtros del panel"}
            .
            {isFic
              ? " Columnas fijas a la izquierda: Nº CDP, Nº RC. Desplace horizontalmente para acto administrativo, desembolso y % avance."
              : source
                ? " Columnas del tema oficial; toque Detalle para ver el expediente completo."
                : " Toca un ítem para ver detalle y ubicación."}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadExcel}
          disabled={total === 0}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ungrd-navy-mid disabled:opacity-50 sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Descargar Excel
        </button>
      </div>

      <label className="mb-4 block min-w-0">
        <span className="sr-only">Buscar en la tabla</span>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
          <input
            type="search"
            value={tableQuery}
            onChange={(e) => setTableQuery(e.target.value)}
            placeholder={
              theme.id === "fic"
                ? "Buscar FIC, municipio, vigencia o estado…"
                : "Buscar en esta tabla (clave, OP, placa, municipio…)"
            }
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2 pr-3 pl-9 text-sm font-semibold text-ungrd-text"
          />
        </div>
      </label>

      <div className="space-y-2 lg:hidden">
        {pageRows.map((row) => {
          const title =
            String(
              (isFic ? row.no_cdp : "") ||
                row.clave_seguimiento ||
                row.id_puente ||
                row.municipio ||
                row.departamento ||
                row.id_legacy ||
                row.id,
            ) || "Registro";
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-ungrd-border bg-ungrd-bg/60 p-3 text-left transition hover:border-ungrd-navy/30 hover:bg-ungrd-yellow/10 active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-extrabold text-ungrd-heading">
                  {isFic ? `CDP ${title}` : title}
                </span>
                <span className="shrink-0 rounded-full bg-ungrd-surface px-2 py-0.5 text-[11px] font-bold text-ungrd-heading ring-1 ring-ungrd-border">
                  {String(row.estado || "—")}
                </span>
              </div>
              {isFic ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-ungrd-muted">Nº RC</dt>
                    <dd className="truncate font-semibold text-ungrd-heading">
                      {displayCellText(row.no_rc as string | number)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ungrd-muted">% avance</dt>
                    <dd className="truncate font-semibold text-ungrd-heading">
                      {displayCellText(
                        row.porcentaje_de_avance_en_el_ejericicio_de_legalizacion as
                          | string
                          | number,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ungrd-muted">Acto admin.</dt>
                    <dd className="truncate font-semibold text-ungrd-heading">
                      {displayCellText(
                        row.fecha_acto_administrativo_resolucion as
                          | string
                          | number,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ungrd-muted">Desembolso</dt>
                    <dd className="truncate font-semibold text-ungrd-heading">
                      {displayCellText(row.fecha as string | number)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="flex min-w-0 items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ungrd-navy" />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-ungrd-muted">
                      {String(row.tipo_registro || row.capa || "—")}
                    </p>
                    <p className="truncate text-sm font-semibold text-ungrd-heading">
                      {[row.municipio, row.departamento]
                        .map((x) => String(x || "").trim())
                        .filter(
                          (x) =>
                            x && !/^sin (departamento|municipio)$/i.test(x),
                        )
                        .join(" · ") || "Sin ubicación en esta capa"}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-ungrd-border/80 pt-2">
                <span className="truncate text-xs text-ungrd-muted">
                  {isFic
                    ? [row.municipio, row.departamento]
                        .map((x) => String(x || "").trim())
                        .filter(Boolean)
                        .join(" · ") || "Sin ubicación"
                    : String(row.fecha || "—")}
                </span>
                <span className="text-sm font-extrabold text-ungrd-heading">
                  {formatCop(Number(row.valor || 0))}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-ungrd-navy">
                <Eye className="h-3.5 w-3.5" />
                Ver detalle
              </span>
            </button>
          );
        })}
        {pageRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-ungrd-border px-3 py-10 text-center text-sm text-ungrd-muted">
            No hay registros con los filtros actuales.
          </p>
        )}
      </div>

      <div className="relative hidden min-w-0 lg:block">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-xl bg-gradient-to-l from-ungrd-surface to-transparent opacity-80" />
        <div className="scroll-thin max-w-full overflow-x-auto rounded-xl border border-ungrd-border">
          <table
            className={`border-collapse text-left text-sm ${
              isFic
                ? "min-w-[92rem] w-max"
                : "w-full min-w-[48rem] table-fixed"
            }`}
          >
            <thead className="bg-ungrd-bg text-xs tracking-wide text-ungrd-muted uppercase">
              <tr>
                {columns.map((col) => {
                  const stickyLeft = stickyLeftByKey.get(col.key);
                  const minW = COL_MIN_WIDTH[col.key] || "8rem";
                  return (
                    <th
                      key={col.key}
                      style={{
                        minWidth: minW,
                        ...(stickyLeft != null
                          ? { left: stickyLeft }
                          : undefined),
                      }}
                      className={`bg-ungrd-bg px-3 py-2.5 font-bold whitespace-nowrap ${
                        stickyLeft != null
                          ? "sticky top-0 z-[3] shadow-[2px_0_0_0_rgba(0,45,90,0.08)]"
                          : "sticky top-0 z-[1]"
                      } ${col.kind === "money" ? "text-right" : ""}`}
                    >
                      {col.label}
                    </th>
                  );
                })}
                <th className="sticky top-0 z-[1] w-[5.5rem] bg-ungrd-bg px-3 py-2.5 font-bold">
                  Ver
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer border-t border-ungrd-border transition hover:bg-ungrd-yellow/15"
                  onClick={() => setSelected(row)}
                >
                  {columns.map((col) => {
                    const stickyLeft = stickyLeftByKey.get(col.key);
                    const minW = COL_MIN_WIDTH[col.key] || "8rem";
                    return (
                      <td
                        key={col.key}
                        style={{
                          minWidth: minW,
                          ...(stickyLeft != null
                            ? { left: stickyLeft }
                            : undefined),
                        }}
                        className={`px-3 py-2.5 ${
                          stickyLeft != null
                            ? "sticky z-[2] bg-ungrd-surface group-hover:bg-ungrd-yellow/15"
                            : ""
                        } ${
                          isFic ? "whitespace-nowrap" : "truncate"
                        } ${
                          col.kind === "money"
                            ? "text-right font-semibold text-ungrd-heading"
                            : col.key === "clave_seguimiento" ||
                                col.key === "departamento" ||
                                col.key === "no_cdp" ||
                                col.key === "no_rc"
                              ? "font-semibold text-ungrd-heading"
                              : "text-ungrd-text"
                        }`}
                      >
                        {renderCell(row, col.key, col.kind)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ungrd-navy">
                      <Eye className="h-3.5 w-3.5" />
                      Detalle
                    </span>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-10 text-center text-sm text-ungrd-muted"
                  >
                    No hay registros con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-ungrd-muted">
          Mostrar
          <select
            value={pageSize}
            onChange={(e) =>
              changePageSize(
                Number(e.target.value) as (typeof PAGE_SIZES)[number],
              )
            }
            className="rounded-lg border border-ungrd-border bg-ungrd-input px-2 py-1.5 text-sm font-semibold text-ungrd-text"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="hidden sm:inline">registros</span>
        </label>

        <p className="text-sm text-ungrd-muted">
          {total === 0
            ? "0 registros"
            : `${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(total)}`}
        </p>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold text-ungrd-heading disabled:opacity-40 sm:flex-none"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sm:hidden">Ant.</span>
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="shrink-0 px-1 text-sm font-semibold text-ungrd-heading tabular-nums">
            {safePage + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold text-ungrd-heading disabled:opacity-40 sm:flex-none"
          >
            <span className="sm:hidden">Sig.</span>
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selected && (
        <RecordDetailModal
          theme={theme}
          record={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
