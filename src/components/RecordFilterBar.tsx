"use client";

import { useState } from "react";
import {
  CalendarRange,
  CircleHelp,
  Filter,
  Layers,
  MapPinned,
  Search,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
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

const GUIDE = [
  {
    icon: Search,
    title: "Buscar clave",
    detail:
      "Encuentre una OP, placa, CDP, serial o texto sin recorrer la lista. Aplica a mando, gráficos y tabla.",
  },
  {
    icon: MapPinned,
    title: "Territorio",
    detail:
      "Departamento y municipio acotan el mapa, el semáforo y las prioridades a esa zona.",
  },
  {
    icon: Layers,
    title: "Estado y capa",
    detail:
      "Estado del trámite y capa (maqueta / bitácora / pago). Sirve para ver solo lo operativo relevante.",
  },
  {
    icon: CalendarRange,
    title: "Fechas",
    detail:
      "Ventana temporal del evento del tema (pago, instalación, etc.). Compatible con el clic en el heatmap.",
  },
  {
    icon: Share2,
    title: "URL compartible",
    detail:
      "Los filtros quedan en la dirección del navegador. Puede copiar el enlace y abrirlo con la misma vista.",
  },
] as const;

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
  const [showGuide, setShowGuide] = useState(false);
  const active = hasActiveFilters(filters);
  const pct =
    total > 0 ? Math.min(100, Math.round((matched / total) * 100)) : 0;

  function patch(partial: Partial<RecordFilterState>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-ungrd-navy/20 bg-ungrd-surface shadow-[0_12px_40px_rgba(0,45,90,0.08)]"
      aria-label="Filtros de exploración"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 bg-[linear-gradient(120deg,#001a36_0%,#0a3d6b_55%,#002d5a_100%)] px-4 py-3.5 text-white sm:px-5">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-ungrd-yellow uppercase">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Exploración filtrada
          </p>
          <h2 className="mt-1 text-base font-extrabold tracking-tight sm:text-lg">
            Encuentre lo que necesita sin desplazarse
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/70 sm:text-sm">
            Busque por clave o recorte por territorio, estado, capa y fechas.
            El resto del panel (mando, mapa, red y tabla) se actualiza al
            instante.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
            aria-expanded={showGuide}
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            {showGuide ? "Ocultar guía" : "¿Para qué sirve?"}
          </button>
          {active ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ungrd-yellow px-3 py-2 text-xs font-extrabold text-ungrd-navy-deep hover:brightness-105"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {showGuide ? (
        <ul className="grid gap-2 border-b border-ungrd-border bg-[#f4f8fc] p-3 sm:grid-cols-2 lg:grid-cols-5 sm:p-4">
          {GUIDE.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-ungrd-border/80 bg-white px-3 py-2.5"
            >
              <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ungrd-navy">
                <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {item.title}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ungrd-muted">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-ungrd-muted">
            <Sparkles className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
            <span>
              Mostrando{" "}
              <strong className="font-extrabold text-ungrd-heading tabular-nums">
                {formatNumber(matched)}
              </strong>{" "}
              de{" "}
              <strong className="font-extrabold text-ungrd-heading tabular-nums">
                {formatNumber(total)}
              </strong>
              {active ? " · filtros activos" : " · sin filtros"}
            </span>
          </p>
          <div
            className="h-1.5 w-28 overflow-hidden rounded-full bg-ungrd-bg sm:w-40"
            title={`${pct}% de la base`}
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-ungrd-navy transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <label className="block min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ungrd-heading uppercase">
            <Search className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
            Buscar clave u OP
          </span>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder="Ej. SMD-12, placa, CDP, municipio…"
              className="w-full rounded-xl border border-ungrd-border bg-ungrd-input py-2.5 pr-3 pl-9 text-sm font-semibold text-ungrd-text shadow-sm outline-none ring-ungrd-navy/20 focus:ring-2"
            />
          </div>
        </label>

        <div
          className={`grid min-w-0 gap-3 sm:grid-cols-2 ${
            showDates ? "xl:grid-cols-3 2xl:grid-cols-6" : "xl:grid-cols-4"
          }`}
        >
          <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
            <span className="inline-flex items-center gap-1.5">
              <MapPinned className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
              Departamento
            </span>
            <select
              value={filters.departamento}
              onChange={(e) =>
                patch({ departamento: e.target.value, municipio: "" })
              }
              className="mt-1 w-full max-w-full rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm"
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
            <span className="inline-flex items-center gap-1.5">
              <MapPinned className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
              Municipio
            </span>
            <select
              value={filters.municipio}
              onChange={(e) => patch({ municipio: e.target.value })}
              disabled={!filters.departamento && municipioOptions.length === 0}
              className="mt-1 w-full max-w-full rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm disabled:opacity-50"
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
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
              Estado
            </span>
            <select
              value={filters.estado}
              onChange={(e) => patch({ estado: e.target.value })}
              className="mt-1 w-full max-w-full rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm"
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
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-ungrd-navy" aria-hidden />
              {capaLabel}
            </span>
            <select
              value={filters.capa}
              onChange={(e) => {
                const capa = e.target.value;
                patch({ capa, tercero: "" });
              }}
              className="mt-1 w-full max-w-full rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm"
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
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange
                    className="h-3.5 w-3.5 text-ungrd-navy"
                    aria-hidden
                  />
                  Desde
                </span>
                <input
                  type="date"
                  value={filters.from}
                  onChange={(e) =>
                    patch({ from: e.target.value, periodo: "" })
                  }
                  className="mt-1 w-full max-w-full min-w-0 rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm"
                />
              </label>
              <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange
                    className="h-3.5 w-3.5 text-ungrd-navy"
                    aria-hidden
                  />
                  Hasta
                </span>
                <input
                  type="date"
                  value={filters.to}
                  onChange={(e) => patch({ to: e.target.value, periodo: "" })}
                  className="mt-1 w-full max-w-full min-w-0 rounded-xl border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case shadow-sm"
                />
              </label>
            </>
          ) : null}
        </div>

        {active ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-ungrd-border/70 pt-3">
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
            Tip: también puede filtrar con un clic en el mapa o en los gráficos.
            Use «¿Para qué sirve?» si es la primera vez.
          </p>
        )}
      </div>
    </section>
  );
}
