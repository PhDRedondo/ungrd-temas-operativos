"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
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
  "id",
  "departamento",
  "municipio",
  "fecha",
  "estado",
  "valor",
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
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
            <Table2 className="h-4 w-4 text-ungrd-navy" />
            Registros · base de datos filtrada
          </h3>
          <p className="mt-1 text-xs text-ungrd-muted">
            {formatNumber(total)} registro{total === 1 ? "" : "s"} según filtros
            activos. Clic en una fila para ver el detalle y la ubicación.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadExcel}
          disabled={total === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ungrd-navy-mid disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Descargar Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ungrd-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ungrd-bg text-xs tracking-wide text-ungrd-muted uppercase">
            <tr>
              {PREVIEW_COLS.map((col) => (
                <th key={col} className="px-3 py-2.5 font-bold">
                  {col}
                </th>
              ))}
              <th className="px-3 py-2.5 font-bold">Ver</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-ungrd-border transition hover:bg-ungrd-yellow/15"
                onClick={() => setSelected(row)}
              >
                <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-xs text-ungrd-muted">
                  {row.id}
                </td>
                <td className="px-3 py-2.5 font-semibold text-ungrd-heading">
                  {String(row.departamento)}
                </td>
                <td className="px-3 py-2.5 text-ungrd-text">
                  {String(row.municipio)}
                </td>
                <td className="px-3 py-2.5 text-ungrd-text">
                  {String(row.fecha)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-ungrd-bg px-2 py-0.5 text-xs font-bold text-ungrd-heading">
                    {String(row.estado)}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-ungrd-heading">
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
          registros
        </label>

        <p className="text-sm text-ungrd-muted">
          {total === 0
            ? "0 registros"
            : `${formatNumber(from)}–${formatNumber(to)} de ${formatNumber(total)}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border px-3 py-1.5 text-sm font-bold text-ungrd-heading disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <span className="text-sm font-semibold text-ungrd-heading">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border px-3 py-1.5 text-sm font-bold text-ungrd-heading disabled:opacity-40"
          >
            Siguiente
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
