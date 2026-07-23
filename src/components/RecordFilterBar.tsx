"use client";

import { Search, X } from "lucide-react";
import { departmentNames } from "@/lib/geo";
import {
  hasActiveFilters,
  type RecordFilterState,
} from "@/lib/analytics/recordFilters";
import { formatNumber } from "@/lib/records/types";

type Props = {
  filters: RecordFilterState;
  onChange: (next: RecordFilterState) => void;
  onClear: () => void;
  estadoOptions: string[];
  capaOptions: string[];
  municipioOptions: string[];
  /** Etiqueta del select de capa (p. ej. Tipo de registro) */
  capaLabel?: string;
  matched: number;
  total: number;
  /** Mostrar fechas from/to */
  showDates?: boolean;
};

export function RecordFilterBar({
  filters,
  onChange,
  onClear,
  estadoOptions,
  capaOptions,
  municipioOptions,
  capaLabel = "Capa / tipo",
  matched,
  total,
  showDates = true,
}: Props) {
  const active = hasActiveFilters(filters);

  function patch(partial: Partial<RecordFilterState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
            Filtros
          </p>
          <p className="mt-0.5 text-xs text-ungrd-muted">
            {formatNumber(matched)} de {formatNumber(total)} registros
            {active ? " · filtros activos" : ""}
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border px-3 py-1.5 text-xs font-extrabold text-ungrd-heading hover:bg-ungrd-bg"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <label className="block min-w-0">
        <span className="text-[11px] font-bold tracking-wide text-ungrd-heading uppercase">
          Buscar clave u OP
        </span>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="OP, placa, CDP, serial, municipio…"
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2 pr-3 pl-9 text-sm font-semibold text-ungrd-text"
          />
        </div>
      </label>

      <div
        className={`grid min-w-0 gap-3 sm:grid-cols-2 ${
          showDates ? "xl:grid-cols-3 2xl:grid-cols-6" : "xl:grid-cols-4"
        }`}
      >
        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Departamento
          <select
            value={filters.departamento}
            onChange={(e) =>
              patch({ departamento: e.target.value, municipio: "" })
            }
            className="mt-1 w-full max-w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          >
            <option value="">Todos</option>
            {departmentNames().map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Municipio
          <select
            value={filters.municipio}
            onChange={(e) => patch({ municipio: e.target.value })}
            disabled={!filters.departamento && municipioOptions.length === 0}
            className="mt-1 w-full max-w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case disabled:opacity-50"
          >
            <option value="">
              {filters.departamento ? "Todos del depto" : "Todos"}
            </option>
            {municipioOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Estado
          <select
            value={filters.estado}
            onChange={(e) => patch({ estado: e.target.value })}
            className="mt-1 w-full max-w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          >
            <option value="">Todos</option>
            {estadoOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          {capaLabel}
          <select
            value={filters.capa}
            onChange={(e) => {
              const capa = e.target.value;
              patch({ capa, tercero: "" });
            }}
            className="mt-1 w-full max-w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          >
            <option value="">Todas</option>
            {capaOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {showDates ? (
          <>
            <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
              Desde
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  patch({ from: e.target.value, periodo: "" })
                }
                className="mt-1 w-full max-w-full min-w-0 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
              />
            </label>
            <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
              Hasta
              <input
                type="date"
                value={filters.to}
                onChange={(e) => patch({ to: e.target.value, periodo: "" })}
                className="mt-1 w-full max-w-full min-w-0 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
              />
            </label>
          </>
        ) : null}
      </div>

      {active ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          {filters.q.trim() ? (
            <button
              type="button"
              onClick={() => patch({ q: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Buscar: {filters.q.trim()} ×
            </button>
          ) : null}
          {filters.departamento ? (
            <button
              type="button"
              onClick={() => patch({ departamento: "", municipio: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Depto: {filters.departamento} ×
            </button>
          ) : null}
          {filters.municipio ? (
            <button
              type="button"
              onClick={() => patch({ municipio: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Mpio: {filters.municipio} ×
            </button>
          ) : null}
          {filters.estado ? (
            <button
              type="button"
              onClick={() => patch({ estado: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Estado: {filters.estado} ×
            </button>
          ) : null}
          {filters.capa ? (
            <button
              type="button"
              onClick={() => patch({ capa: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              {capaLabel}: {filters.capa} ×
            </button>
          ) : null}
          {filters.tercero ? (
            <button
              type="button"
              onClick={() => patch({ tercero: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Corte: {filters.tercero} ×
            </button>
          ) : null}
          {filters.periodo ? (
            <button
              type="button"
              onClick={() => patch({ periodo: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Periodo: {filters.periodo} ×
            </button>
          ) : null}
          {(filters.from || filters.to) && !filters.periodo ? (
            <button
              type="button"
              onClick={() => patch({ from: "", to: "" })}
              className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
            >
              Fechas ×
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-ungrd-muted">
          Escriba una clave o use los selects. Los clics en mapa y gráficos
          también aplican filtro cruzado.
        </p>
      )}
    </div>
  );
}
