"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MapPin,
  Table2,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, formatNumber, type RecordRow } from "@/lib/data";

const RecordDetailModal = dynamic(
  () =>
    import("./RecordDetailModal").then((m) => m.RecordDetailModal),
  { ssr: false },
);

const PAGE_SIZES = [10, 20, 50, 100] as const;

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
};

const PREVIEW_COLS = [
  { key: "id", label: "ID", className: "w-[9rem]" },
  { key: "departamento", label: "Departamento", className: "min-w-[8rem]" },
  { key: "municipio", label: "Municipio", className: "min-w-[7rem]" },
  { key: "fecha", label: "Fecha", className: "w-[6.5rem]" },
  { key: "estado", label: "Estado", className: "w-[8rem]" },
  { key: "valor", label: "Valor", className: "w-[8rem] text-right" },
] as const;

export function RecordsDataTable({ theme, records }: Props) {
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RecordRow | null>(null);

  useEffect(() => {
    setPage(0);
  }, [records]);

  const total = records.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, pageCount - 1);

  const pageRows = useMemo(() => {
    const start = safePage * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, safePage, pageSize]);

  function changePageSize(n: (typeof PAGE_SIZES)[number]) {
    setPageSize(n);
    setPage(0);
  }

  function downloadExcel() {
    const headers = theme.fields.map((f) => f.name);
    const withId = ["id", ...headers.filter((h) => h !== "id")];
    const rows = records.map((r) =>
      withId.map((h) => (r[h] === undefined ? "" : r[h])),
    );
    const ws = XLSX.utils.aoa_to_sheet([withId, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, theme.shortName.slice(0, 28));
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${theme.id}_filtrados_${stamp}.xlsx`);
  }

  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  return (
    <section className="min-w-0 w-full max-w-full overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 xl:col-span-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
            <Table2 className="h-4 w-4 shrink-0 text-ungrd-navy" />
            <span className="truncate">Registros · base filtrada</span>
          </h3>
          <p className="mt-1 text-xs text-ungrd-muted">
            {formatNumber(total)} registro{total === 1 ? "" : "s"} según filtros.
            Toca un ítem para ver detalle y ubicación.
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

      {/* Mobile / tablet: card list — avoids horizontal overflow */}
      <div className="space-y-2 lg:hidden">
        {pageRows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelected(row)}
            className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-ungrd-border bg-ungrd-bg/60 p-3 text-left transition hover:border-ungrd-navy/30 hover:bg-ungrd-yellow/10 active:scale-[0.995]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-[11px] text-ungrd-muted">
                {row.id}
              </span>
              <span className="shrink-0 rounded-full bg-ungrd-surface px-2 py-0.5 text-[11px] font-bold text-ungrd-heading ring-1 ring-ungrd-border">
                {String(row.estado)}
              </span>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ungrd-navy" />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ungrd-heading">
                  {String(row.municipio)}
                </p>
                <p className="truncate text-xs text-ungrd-muted">
                  {String(row.departamento)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-ungrd-border/80 pt-2">
              <span className="text-xs text-ungrd-muted">{String(row.fecha)}</span>
              <span className="text-sm font-extrabold text-ungrd-heading">
                {formatCop(Number(row.valor || 0))}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-ungrd-navy">
              <Eye className="h-3.5 w-3.5" />
              Ver detalle
            </span>
          </button>
        ))}
        {pageRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-ungrd-border px-3 py-10 text-center text-sm text-ungrd-muted">
            No hay registros con los filtros actuales.
          </p>
        )}
      </div>

      {/* Desktop: contained table with sticky ID column */}
      <div className="relative hidden min-w-0 lg:block">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-xl bg-gradient-to-l from-ungrd-surface to-transparent opacity-80" />
        <div className="scroll-thin max-w-full overflow-x-auto rounded-xl border border-ungrd-border">
          <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
            <thead className="bg-ungrd-bg text-xs tracking-wide text-ungrd-muted uppercase">
              <tr>
                {PREVIEW_COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`sticky top-0 z-[1] bg-ungrd-bg px-3 py-2.5 font-bold ${col.className} ${
                      col.key === "id" ? "left-0 z-[2] shadow-[2px_0_6px_rgba(0,45,90,0.06)]" : ""
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
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
                  <td className="sticky left-0 z-[1] truncate bg-ungrd-surface px-3 py-2.5 font-mono text-xs text-ungrd-muted shadow-[2px_0_6px_rgba(0,45,90,0.06)] group-hover:bg-ungrd-bg">
                    {row.id}
                  </td>
                  <td className="truncate px-3 py-2.5 font-semibold text-ungrd-heading">
                    {String(row.departamento)}
                  </td>
                  <td className="truncate px-3 py-2.5 text-ungrd-text">
                    {String(row.municipio)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ungrd-text">
                    {String(row.fecha)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block max-w-full truncate rounded-full bg-ungrd-bg px-2 py-0.5 text-xs font-bold text-ungrd-heading">
                      {String(row.estado)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-ungrd-heading">
                    {formatCop(Number(row.valor || 0))}
                  </td>
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
                    colSpan={PREVIEW_COLS.length + 1}
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
              changePageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])
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
