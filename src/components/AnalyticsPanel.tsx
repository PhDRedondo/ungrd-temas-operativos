"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";
import { SankeyFlowDiagram } from "@/components/SankeyFlowDiagram";
import { DecisionDashboard } from "@/components/DecisionDashboard";
import { ClaveCapasTimeline } from "@/components/ClaveCapasTimeline";
import { RecordsDataTable } from "@/components/RecordsDataTable";
import { RecordFilterBar } from "@/components/RecordFilterBar";
import type { MapPoint } from "@/components/ColombiaMap";
import { isSourceTheme } from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import {
  applyRecordFilters,
  capaOf,
  EMPTY_RECORD_FILTERS,
  hasActiveFilters,
  uniqueSorted,
  type RecordFilterState,
} from "@/lib/analytics/recordFilters";
import {
  aggregateSpatial,
  resolveDepartment,
  type MapMetric,
} from "@/lib/geo/spatial";
import {
  getThemeMapSemantics,
  resolveAutoMapMetric,
} from "@/lib/geo/themeMapSemantics";
import {
  buildThemeTimeSeries,
  resolveEventDate,
  type SeriesWindow,
} from "@/lib/analytics/timeSeries";

const ColombiaMap = dynamic(
  () => import("./ColombiaMap").then((m) => m.ColombiaMap),
  { ssr: false },
);

const COLORS = [
  "#002d5a",
  "#ffd100",
  "#0a3d6b",
  "#5a6b7d",
  "#1f7a4d",
  "#b54708",
  "#3d7ea6",
  "#8a6d1d",
];

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
  filters: RecordFilterState;
  onFiltersChange: (next: RecordFilterState) => void;
};

type SqlAgg = {
  totals: { count: number; valor: number };
  byDepartamento: { key: string; count: number; valor: number }[];
  byEstado: { key: string; count: number; valor: number }[];
  byMonth: { key: string; count: number; valor: number }[];
  byTipoRegistro?: { key: string; count: number; valor: number }[];
  byClaveSeguimiento?: { key: string; count: number; valor: number }[];
};

function toggle(current: string, next: string) {
  return current === next ? "" : next;
}

export function AnalyticsPanel({
  theme,
  records,
  filters,
  onFiltersChange,
}: Props) {
  const sourceTheme = isSourceTheme(theme.id);
  const mapSem = useMemo(() => getThemeMapSemantics(theme), [theme]);
  const {
    departamento,
    municipio,
    estado,
    tercero,
    periodo,
    from,
    to,
  } = filters;
  const [sqlAgg, setSqlAgg] = useState<SqlAgg | null>(null);

  const patchFilters = useCallback(
    (partial: Partial<RecordFilterState>) => {
      onFiltersChange({ ...filters, ...partial });
    },
    [filters, onFiltersChange],
  );
  const [mapMetricOverride, setMapMetricOverride] = useState<
    MapMetric | "auto"
  >("auto");
  const [seriesMetricOverride, setSeriesMetricOverride] = useState<
    MapMetric | "auto"
  >("auto");
  const [seriesWindow, setSeriesWindow] = useState<SeriesWindow>("24");

  const workingRecords = useMemo(
    () => (sourceTheme ? enrichRecordsForDecision(records) : records),
    [records, sourceTheme],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSql() {
      try {
        const res = await fetch(`/api/themes/${theme.id}/analytics`);
        if (!res.ok) return;
        const data = (await res.json()) as SqlAgg;
        if (!cancelled) setSqlAgg(data);
      } catch {
        /* analítica cliente sigue operativa */
      }
    }
    void loadSql();
    return () => {
      cancelled = true;
    };
  }, [theme.id, records.length]);

  const tipoRegistroField = theme.fields.find((f) => f.name === "tipo_registro");
  const categoryField =
    tipoRegistroField ||
    theme.fields.find(
      (f) =>
        f.type === "select" &&
        !["departamento", "estado", "municipio"].includes(f.name),
    );
  const pieUsesEstado = !categoryField;
  const thirdKey = categoryField?.name || "municipio";
  const thirdLabel = categoryField?.label || "Municipio";

  const estadoOptions = useMemo(() => {
    if (sourceTheme) {
      return uniqueSorted(
        workingRecords.map((r) => String(r.estado || "")),
      );
    }
    return ["Programado", "En ejecución", "Finalizado", "Suspendido"];
  }, [workingRecords, sourceTheme]);

  const capaOptions = useMemo(
    () => uniqueSorted(workingRecords.map((r) => capaOf(r))),
    [workingRecords],
  );

  const municipioOptions = useMemo(() => {
    const rows = departamento
      ? workingRecords.filter((r) => r.departamento === departamento)
      : workingRecords;
    return uniqueSorted(
      rows
        .map((r) => String(r.municipio || ""))
        .filter((m) => m && !/^sin municipio$/i.test(m)),
    );
  }, [workingRecords, departamento]);

  const filtered = useMemo(
    () =>
      applyRecordFilters(workingRecords, filters, {
        themeId: theme.id,
        thirdKey,
      }),
    [workingRecords, filters, theme.id, thirdKey],
  );

  const hasFilters = hasActiveFilters(filters);

  const clearFilters = useCallback(() => {
    onFiltersChange({ ...EMPTY_RECORD_FILTERS });
  }, [onFiltersChange]);

  const cards = useMemo(() => {
    const total = filtered.length;
    const valor = filtered.reduce((s, r) => s + Number(r.valor || 0), 0);
    const depts = new Set(
      filtered.map((r) => r.departamento).filter(Boolean),
    ).size;
    if (sourceTheme) {
      const capas = new Set(
        filtered
          .map((r) => String(r.tipo_registro || r.capa || "").trim())
          .filter(Boolean),
      ).size;
      const claves = new Set(
        filtered
          .map((r) => String(r.clave_seguimiento || "").trim())
          .filter(Boolean),
      ).size;
      return [
        { label: "Registros filtrados", value: formatNumber(total) },
        { label: theme.valueLabel, value: formatCop(valor) },
        { label: "Departamentos", value: formatNumber(depts) },
        {
          label: capas ? "Capas / tipos" : "Claves seguimiento",
          value: formatNumber(capas || claves),
        },
      ];
    }
    const finalizados = filtered.filter((r) => r.estado === "Finalizado").length;
    return [
      { label: "Registros", value: formatNumber(total) },
      { label: theme.valueLabel, value: formatCop(valor) },
      { label: "Departamentos", value: formatNumber(depts) },
      {
        label: "% finalizados",
        value: `${total ? Math.round((finalizados / total) * 100) : 0}%`,
      },
    ];
  }, [filtered, theme.valueLabel, sourceTheme]);

  const byEstado = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(String(r.estado), (map.get(String(r.estado)) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const spatial = useMemo(
    () =>
      aggregateSpatial(filtered, {
        department: departamento || undefined,
      }),
    [filtered, departamento],
  );

  const mapMetric: MapMetric =
    mapMetricOverride === "auto"
      ? resolveAutoMapMetric(theme, spatial.metric === "valor")
      : mapMetricOverride;

  const byDept = useMemo(() => {
    const useValor = mapMetric === "valor";
    return spatial.areas
      .filter((a) => (useValor ? a.valor > 0 : a.count > 0))
      .slice(0, 10)
      .map((a) => ({
        name: a.name,
        value: useValor ? a.valor : a.count,
        metric: useValor ? ("valor" as const) : ("count" as const),
      }));
  }, [spatial, mapMetric]);

  const mapRank = useMemo(() => {
    return spatial.areas
      .map((a) => ({
        name: a.name,
        value: mapMetric === "valor" ? a.valor : a.count,
        count: a.count,
        valor: a.valor,
      }))
      .filter((a) => a.value > 0)
      .slice(0, 12);
  }, [spatial.areas, mapMetric]);

  const timeSeries = useMemo(
    () =>
      buildThemeTimeSeries(filtered, theme, seriesMetricOverride, {
        window: seriesWindow,
      }),
    [filtered, theme, seriesMetricOverride, seriesWindow],
  );

  const heatmap = useMemo(() => {
    let months = Array.from(
      new Set(
        filtered
          .map((r) => resolveEventDate(r, theme.id).slice(0, 7))
          .filter((m) => /^\d{4}-\d{2}/.test(m)),
      ),
    ).sort();
    // Misma ventana corta que la serie (legible)
    if (seriesWindow !== "all" && months.length > Number(seriesWindow)) {
      months = months.slice(-Number(seriesWindow));
    } else if (months.length > 24) {
      months = months.slice(-24);
    }
    const depts = Array.from(
      new Set(
        filtered
          .map((r) => resolveDepartment(String(r.departamento || ""))?.name)
          .filter((d): d is string => Boolean(d)),
      ),
    ).slice(0, 10);
    let anyValor = false;
    for (const r of filtered) {
      if (
        Number(r.valor || 0) > 0 &&
        !/^sin departamento$/i.test(String(r.departamento || ""))
      ) {
        anyValor = true;
        break;
      }
    }
    const heatMetric = resolveAutoMapMetric(theme, anyValor);
    const useValor = heatMetric === "valor";
    const matrix = depts.map((dept) => ({
      dept,
      cells: months.map((m) => {
        const rows = filtered.filter(
          (r) =>
            resolveDepartment(String(r.departamento || ""))?.name === dept &&
            resolveEventDate(r, theme.id).startsWith(m),
        );
        const value = useValor
          ? rows.reduce((s, r) => s + Number(r.valor || 0), 0)
          : rows.length;
        return { month: m, value };
      }),
    }));
    const max = Math.max(
      ...matrix.flatMap((row) => row.cells.map((c) => c.value)),
      1,
    );
    return {
      months,
      matrix,
      max,
      metric: heatMetric,
      useful: months.length > 1 && depts.length > 0 && max > 0,
    };
  }, [filtered, theme, seriesWindow]);

  const deptBarUsesValor = byDept[0]?.metric !== "count";

  const sankeyRecords = useMemo(
    () =>
      filtered.map((r) => ({
        departamento: String(r.departamento),
        estado: String(r.estado),
        tercero: String(r[thirdKey] || "N/D"),
      })),
    [filtered, thirdKey],
  );

  const byCategory = useMemo(() => {
    if (!categoryField) return byEstado;
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = String(r[categoryField.name] || "N/D");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered, categoryField, byEstado]);

  function onSankeyNodeClick(column: 0 | 1 | 2, name: string) {
    if (column === 0) {
      patchFilters({
        departamento: toggle(departamento, name),
        municipio: "",
      });
    } else if (column === 1) {
      patchFilters({ estado: toggle(estado, name) });
    } else {
      const next = toggle(tercero, name);
      const isCapaDim =
        thirdKey === "tipo_registro" || thirdKey === "capa";
      patchFilters({
        tercero: next,
        capa: isCapaDim ? next : filters.capa,
      });
    }
  }

  function onMapSelect(point: MapPoint) {
    if (point.level === "departamento") {
      const next = toggle(departamento, point.name);
      patchFilters({
        departamento: next,
        municipio: next === departamento ? municipio : "",
      });
    } else {
      patchFilters({ municipio: toggle(municipio, point.name) });
    }
  }

  function onPieClick(name: string) {
    if (pieUsesEstado) {
      patchFilters({ estado: toggle(estado, name) });
    } else {
      const next = toggle(tercero, name);
      const isCapaDim =
        thirdKey === "tipo_registro" || thirdKey === "capa";
      patchFilters({
        tercero: next,
        capa: isCapaDim ? next : filters.capa,
      });
    }
  }

  function onBarClick(name: string) {
    patchFilters({
      departamento: toggle(departamento, name),
      municipio: "",
    });
  }

  function onPeriodClick(period: string) {
    const next = toggle(periodo, period);
    patchFilters({
      periodo: next,
      from: next ? "" : from,
      to: next ? "" : to,
    });
  }

  function onHeatmapCell(dept: string, month: string) {
    const same = departamento === dept && periodo === month;
    if (same) {
      patchFilters({ departamento: "", periodo: "", municipio: "" });
      return;
    }
    patchFilters({
      departamento: dept,
      municipio: "",
      periodo: month,
      from: "",
      to: "",
    });
  }

  const sqlSynced =
    !hasFilters && sqlAgg != null && sqlAgg.totals.count === records.length;

  return (
    <div
      className="min-w-0 max-w-full space-y-4 sm:space-y-5"
      id="tour-analitica"
    >
      <RecordFilterBar
        filters={filters}
        onChange={onFiltersChange}
        onClear={clearFilters}
        estadoOptions={estadoOptions}
        capaOptions={capaOptions}
        municipioOptions={municipioOptions}
        capaLabel={
          tipoRegistroField?.label || categoryField?.label || "Capa / tipo"
        }
        matched={filtered.length}
        total={workingRecords.length}
        showDates
      />

      {sourceTheme ? (
        <DecisionDashboard
          themeId={theme.id}
          themeName={theme.name}
          records={hasFilters ? filtered : workingRecords}
        />
      ) : null}

      {sourceTheme ? (
        <ClaveCapasTimeline
          themeName={theme.name}
          records={hasFilters ? filtered : workingRecords}
          initialQuery={filters.q}
        />
      ) : null}

      {sourceTheme ? (
        <aside className="rounded-2xl border border-ungrd-navy/15 bg-ungrd-surface px-4 py-3 text-sm text-ungrd-muted sm:px-5">
          <p className="text-xs font-extrabold tracking-[0.16em] text-ungrd-navy uppercase">
            Cómo interpretar este tablero
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed">
            <li>
              El <strong className="font-bold text-ungrd-heading">centro de mando</strong>{" "}
              (arriba) es la lectura ejecutiva: semáforos, alertas y prioridades.
            </li>
            <li>
              Bitácoras y pagos suelen llegar sin municipio: el sistema{" "}
              <strong className="font-bold text-ungrd-heading">
                completa ubicación y valor
              </strong>{" "}
              cruzando la misma orden/placa/CDP de la maqueta.
            </li>
            <li>
              Mapa, barras y calor muestran{" "}
              <strong className="font-bold text-ungrd-heading">
                valor en pesos
              </strong>{" "}
              cuando existe; si no, muestran{" "}
              <strong className="font-bold text-ungrd-heading">
                cantidad de registros
              </strong>{" "}
              (actividad operativa).
            </li>
            <li>
              La tabla inferior lista la base filtrada con columnas propias del
              tema (clave, capa, estado real). Use «Detalle» para el expediente.
            </li>
          </ul>
        </aside>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ungrd-muted">
        <span>
          {sourceTheme
            ? "Exploración geográfica y cortes sobre la base oficial"
            : "Gráficos y mapa desde PostgreSQL"}
          {sqlAgg
            ? ` · SQL: ${formatNumber(sqlAgg.totals.count)} filas / ${formatCop(sqlAgg.totals.valor)}`
            : ""}
        </span>
        {sqlSynced ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
            Cliente ↔ SQL sincronizados
          </span>
        ) : null}
      </div>

      {records.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ungrd-border px-4 py-8 text-center text-sm text-ungrd-muted">
          Sin registros. Capture en el formulario o cargue la plantilla Excel
          para ver mapa y gráficos.
        </p>
      ) : null}

      <p className="text-xs text-ungrd-muted">
        Clic en mapa, barras o diagramas para filtro cruzado adicional.
      </p>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <article
            key={c.label}
            className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4"
          >
            <p className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              {c.label}
            </p>
            <p className="mt-2 break-words text-xl font-extrabold text-ungrd-heading tabular-nums sm:text-2xl">
              {c.value}
            </p>
          </article>
        ))}
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-navy/20 bg-ungrd-surface p-3 sm:p-4">
        <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-ungrd-heading">
              Mapa coroplético ·{" "}
              {departamento ? `${departamento} (municipios)` : "Colombia (departamentos)"}
            </h3>
            <p className="mt-1 text-xs text-ungrd-muted">
              Polígonos MGN DANE 2024 · nombres alineados a DIVIPOLA · clic en
              territorio filtra todo el tablero
              {spatial.unmatched
                ? ` · ${formatNumber(spatial.unmatched)} filas sin geo resoluble`
                : ""}
              .
            </p>
          </div>
          <div className="inline-flex max-w-full flex-wrap rounded-xl border border-ungrd-border bg-ungrd-bg p-1">
            {(
              [
                ["auto", "Auto"],
                ["valor", mapSem.toggleValor],
                ["count", mapSem.toggleCount],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMapMetricOverride(id)}
                title={label}
                className={`max-w-[11rem] truncate rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  mapMetricOverride === id
                    ? "bg-ungrd-navy text-white"
                    : "text-ungrd-muted hover:text-ungrd-heading"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            <ColombiaMap
              areas={spatial.areas}
              metric={mapMetric}
              metricLabel={mapSem.metricLabel(mapMetric)}
              legendTitle={mapSem.legendTitle(mapMetric)}
              legendHint={mapSem.legendHint(mapMetric)}
              tooltipPrimaryLabel={mapSem.tooltipPrimary(mapMetric)}
              selectedDepartment={departamento}
              selectedName={departamento ? municipio : departamento}
              onSelect={onMapSelect}
              onClearDepartment={() => {
                patchFilters({ departamento: "", municipio: "" });
              }}
            />
          </div>
          <div className="min-w-0 rounded-xl border border-ungrd-border bg-ungrd-bg/50 p-3 lg:col-span-2">
            <h4 className="text-xs font-extrabold tracking-[0.14em] text-ungrd-navy uppercase">
              Ranking espacial · {mapSem.legendTitle(mapMetric)}
            </h4>
            <p className="mt-1 mb-3 text-[11px] text-ungrd-muted">
              Clic en una fila = mismo filtro espacial que el mapa.
            </p>
            {mapRank.length === 0 ? (
              <p className="text-sm text-ungrd-muted">
                Sin territorios con dato bajo el filtro actual.
              </p>
            ) : (
              <ol className="max-h-[380px] space-y-1.5 overflow-auto pr-1">
                {mapRank.map((item, idx) => {
                  const isSelected = departamento
                    ? municipio === item.name
                    : departamento === item.name;
                  const max = mapRank[0]?.value || 1;
                  const pct = Math.round((item.value / max) * 100);
                  return (
                    <li key={item.name}>
                      <button
                        type="button"
                        onClick={() => {
                          if (departamento) {
                            patchFilters({
                              municipio: toggle(municipio, item.name),
                            });
                          } else {
                            patchFilters({
                              departamento: toggle(departamento, item.name),
                              municipio: "",
                            });
                          }
                        }}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                          isSelected
                            ? "border-ungrd-yellow bg-ungrd-yellow/20"
                            : "border-transparent hover:border-ungrd-border hover:bg-ungrd-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-bold text-ungrd-heading">
                            <span className="mr-1.5 text-xs text-ungrd-muted">
                              {idx + 1}.
                            </span>
                            {item.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-xs font-extrabold text-ungrd-navy">
                            {mapMetric === "valor"
                              ? formatCop(item.value)
                              : formatNumber(item.value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ungrd-border/60">
                          <div
                            className="h-full rounded-full bg-ungrd-navy"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {mapMetric === "valor" && item.count > 0 ? (
                          <p className="mt-1 text-[10px] text-ungrd-muted">
                            {formatNumber(item.count)} registros
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Distribución · {categoryField?.label || "Estado"}
          </h3>
          <div className="h-64 min-w-0 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="28%"
                  outerRadius="68%"
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(_, index) => {
                    const item = byCategory[index];
                    if (item) onPieClick(item.name);
                  }}
                >
                  {byCategory.map((entry, i) => {
                    const active = pieUsesEstado
                      ? estado === entry.name
                      : tercero === entry.name;
                    return (
                      <Cell
                        key={entry.name}
                        fill={COLORS[i % COLORS.length]}
                        stroke={active ? "#ffd100" : "transparent"}
                        strokeWidth={active ? 3 : 0}
                        opacity={
                          (pieUsesEstado ? estado : tercero) && !active
                            ? 0.35
                            : 1
                        }
                      />
                    );
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Top {departamento ? "municipios" : "departamentos"} (
            {mapSem.legendTitle(deptBarUsesValor ? "valor" : "count")})
          </h3>
          <div className="h-64 min-w-0 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byDept}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) =>
                    v.length > 10 ? `${v.slice(0, 9)}…` : v
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    deptBarUsesValor
                      ? formatCop(Number(v))
                      : `${formatNumber(Number(v))} registros`
                  }
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const name = (data as { name?: string })?.name;
                    if (name) onBarClick(name);
                  }}
                >
                  {byDept.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        departamento === entry.name ? "#ffd100" : "#002d5a"
                      }
                      opacity={
                        departamento && departamento !== entry.name ? 0.35 : 1
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-ungrd-heading">
                {timeSeries.title}
              </h3>
              <p className="mt-1 text-xs text-ungrd-muted">
                {timeSeries.subtitle}
                {timeSeries.unmatchedDates > 0
                  ? ` · ${formatNumber(timeSeries.unmatchedDates)} filas sin fecha usable`
                  : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="inline-flex max-w-full flex-wrap rounded-xl border border-ungrd-border bg-ungrd-bg p-1">
                {(
                  [
                    ["auto", "Auto"],
                    ["valor", mapSem.toggleValor],
                    ["count", mapSem.toggleCount],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => setSeriesMetricOverride(id)}
                    className={`max-w-[10rem] truncate rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                      seriesMetricOverride === id
                        ? "bg-ungrd-navy text-white"
                        : "text-ungrd-muted hover:text-ungrd-heading"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-xl border border-ungrd-border bg-ungrd-bg p-1">
                {(
                  [
                    ["12", "12 m"],
                    ["24", "24 m"],
                    ["36", "36 m"],
                    ["all", "Todo"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSeriesWindow(id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                      seriesWindow === id
                        ? "bg-ungrd-yellow text-ungrd-navy-deep"
                        : "text-ungrd-muted hover:text-ungrd-heading"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {timeSeries.points.length === 0 ? (
            <p className="rounded-xl bg-ungrd-bg/60 px-3 py-6 text-center text-sm text-ungrd-muted">
              Sin fechas válidas para armar la serie en {theme.name}. Revise el
              campo fecha / fechas de capa en la carga.
            </p>
          ) : (
            <div className="h-64 min-w-0 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timeSeries.points}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  onClick={(state) => {
                    const label = state?.activeLabel;
                    if (typeof label === "string") onPeriodClick(label);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={48}
                    tickFormatter={(v: number) => {
                      if (timeSeries.metric === "valor") {
                        if (v >= 1_000_000_000)
                          return `${(v / 1_000_000_000).toFixed(1)}B`;
                        if (v >= 1_000_000)
                          return `${Math.round(v / 1_000_000)}M`;
                        if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
                      }
                      return formatNumber(v);
                    }}
                  />
                  <Tooltip
                    formatter={(v, _n, item) => {
                      const payload = item?.payload as
                        | { count?: number; valor?: number }
                        | undefined;
                      const main =
                        timeSeries.metric === "valor"
                          ? formatCop(Number(v))
                          : `${formatNumber(Number(v))} ${theme.unit || "reg."}`;
                      const extra =
                        timeSeries.metric === "valor"
                          ? ` · ${formatNumber(payload?.count || 0)} reg.`
                          : payload?.valor
                            ? ` · ${formatCop(payload.valor)}`
                            : "";
                      return [`${main}${extra}`, timeSeries.yLabel];
                    }}
                    labelFormatter={(label) =>
                      `${timeSeries.dateLabel}: ${label}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={timeSeries.yLabel}
                    stroke="#ffd100"
                    strokeWidth={3}
                    connectNulls
                    cursor="pointer"
                    activeDot={{
                      r: 7,
                      onClick: (_, payload) => {
                        const p = payload as { payload?: { period?: string } };
                        if (p?.payload?.period) onPeriodClick(p.payload.period);
                      },
                    }}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const active = periodo === payload.period;
                      const hasData =
                        (payload.count || 0) > 0 || (payload.valor || 0) > 0;
                      if (!hasData) {
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={2}
                            fill="#cbd5e1"
                            stroke="none"
                          />
                        );
                      }
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={active ? 6 : 3.5}
                          fill={active ? "#ffd100" : "#002d5a"}
                          stroke={active ? "#002d5a" : "none"}
                          strokeWidth={active ? 2 : 0}
                          style={{ cursor: "pointer" }}
                          onClick={() => onPeriodClick(payload.period)}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {!sourceTheme ? (
          <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4 xl:col-span-2">
            <SankeyFlowDiagram
              records={sankeyRecords}
              thirdLabel={thirdLabel}
              onNodeClick={onSankeyNodeClick}
              activeFilters={{ departamento, estado, tercero }}
            />
          </section>
        ) : null}

        {heatmap.useful ? (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4 xl:col-span-2">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            {mapSem.heatmapTitle(heatmap.metric)}
          </h3>
          <p className="mb-2 text-xs text-ungrd-muted">
            {mapSem.heatmapHint(heatmap.metric)}
          </p>
          <div className="scroll-thin -mx-1 max-w-full overflow-x-auto px-1">
            <table className="w-max min-w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-ungrd-surface px-2 py-2 text-left font-bold text-ungrd-heading shadow-[2px_0_6px_rgba(0,45,90,0.06)]">
                    Depto
                  </th>
                  {heatmap.months.map((m) => (
                    <th
                      key={m}
                      className="cursor-pointer px-2 py-2 text-center font-bold text-ungrd-muted hover:text-ungrd-heading"
                      onClick={() => onPeriodClick(m)}
                    >
                      <span
                        className={
                          periodo === m
                            ? "rounded bg-ungrd-yellow px-1 text-ungrd-navy-deep"
                            : undefined
                        }
                      >
                        {m.slice(2)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.matrix.map((row) => (
                  <tr key={row.dept}>
                    <td
                      className="sticky left-0 z-[1] cursor-pointer whitespace-nowrap bg-ungrd-surface px-2 py-1.5 font-semibold text-ungrd-heading shadow-[2px_0_6px_rgba(0,45,90,0.06)] hover:underline"
                      onClick={() => onBarClick(row.dept)}
                    >
                      <span
                        className={
                          departamento === row.dept
                            ? "rounded bg-ungrd-yellow px-1 text-ungrd-navy-deep"
                            : undefined
                        }
                      >
                        {row.dept.length > 14
                          ? `${row.dept.slice(0, 13)}…`
                          : row.dept}
                      </span>
                    </td>
                    {row.cells.map((cell) => {
                      const intensity = cell.value / heatmap.max;
                      const active =
                        departamento === row.dept && periodo === cell.month;
                      return (
                        <td key={cell.month} className="px-1 py-1">
                          <button
                            type="button"
                            title={
                              heatmap.metric === "valor"
                                ? `${row.dept} · ${cell.month}: ${formatCop(cell.value)}`
                                : `${row.dept} · ${cell.month}: ${formatNumber(cell.value)} registros`
                            }
                            onClick={() =>
                              onHeatmapCell(row.dept, cell.month)
                            }
                            className="flex h-8 min-w-11 w-full items-center justify-center rounded-md text-[10px] font-bold transition hover:ring-2 hover:ring-ungrd-yellow sm:min-w-14"
                            style={{
                              background: active
                                ? "#ffd100"
                                : `color-mix(in srgb, #ffd100 ${Math.round(intensity * 90)}%, #e8eef4)`,
                              color: intensity > 0.55 || active ? "#001a36" : "#5a6b7d",
                              opacity:
                                (departamento || periodo) && !active
                                  ? departamento === row.dept ||
                                    periodo === cell.month
                                    ? 1
                                    : 0.4
                                  : 1,
                              outline: active ? "2px solid #002d5a" : undefined,
                            }}
                          >
                            {cell.value
                              ? heatmap.metric === "valor"
                                ? `${Math.round(cell.value / 1_000_000)}M`
                                : formatNumber(cell.value)
                              : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        ) : null}

        <RecordsDataTable theme={theme} records={filtered} />
      </div>

      {sqlAgg && !hasFilters ? (
        <p className="text-xs text-ungrd-muted">
          Agregación SQL: {sqlAgg.byDepartamento.length} deptos ·{" "}
          {sqlAgg.byEstado.length} estados · {sqlAgg.byMonth.length} meses
          {sqlAgg.byTipoRegistro?.length
            ? ` · ${sqlAgg.byTipoRegistro.length} capas (maqueta/bitácora)`
            : ""}
          {sqlAgg.byClaveSeguimiento?.length
            ? ` · top ${sqlAgg.byClaveSeguimiento.length} claves de seguimiento`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}
