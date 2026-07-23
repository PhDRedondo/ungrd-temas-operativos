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
import { departmentNames } from "@/lib/geo";
import { SankeyFlowDiagram } from "@/components/SankeyFlowDiagram";
import { DecisionDashboard } from "@/components/DecisionDashboard";
import { RecordsDataTable } from "@/components/RecordsDataTable";
import type { MapPoint } from "@/components/ColombiaMap";
import { isSourceTheme } from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";

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

export function AnalyticsPanel({ theme, records }: Props) {
  const sourceTheme = isSourceTheme(theme.id);
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [tercero, setTercero] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sqlAgg, setSqlAgg] = useState<SqlAgg | null>(null);

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
      const set = new Set<string>();
      for (const r of workingRecords) {
        const e = String(r.estado || "").trim();
        if (e) set.add(e);
      }
      return [...set].sort((a, b) => a.localeCompare(b, "es"));
    }
    return ["Programado", "En ejecución", "Finalizado", "Suspendido"];
  }, [workingRecords, sourceTheme]);

  const filtered = useMemo(() => {
    return workingRecords.filter((r) => {
      if (departamento && r.departamento !== departamento) return false;
      if (municipio && r.municipio !== municipio) return false;
      if (estado && r.estado !== estado) return false;
      if (tercero && String(r[thirdKey] || "") !== tercero) return false;
      if (periodo && !String(r.fecha).startsWith(periodo)) return false;
      if (!periodo && from && String(r.fecha) < from) return false;
      if (!periodo && to && String(r.fecha) > to) return false;
      return true;
    });
  }, [
    workingRecords,
    departamento,
    municipio,
    estado,
    tercero,
    thirdKey,
    periodo,
    from,
    to,
  ]);

  const hasFilters = Boolean(
    departamento || municipio || estado || tercero || periodo || from || to,
  );

  const clearFilters = useCallback(() => {
    setDepartamento("");
    setMunicipio("");
    setEstado("");
    setTercero("");
    setPeriodo("");
    setFrom("");
    setTo("");
  }, []);

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

  const byDept = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of filtered) {
      const key = String(r.departamento || "").trim();
      if (!key || /^sin departamento$/i.test(key)) continue;
      const cur = map.get(key) || { valor: 0, count: 0 };
      cur.valor += Number(r.valor || 0);
      cur.count += 1;
      map.set(key, cur);
    }
    const useValor = [...map.values()].some((v) => v.valor > 0);
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        value: useValor ? v.valor : v.count,
        metric: useValor ? ("valor" as const) : ("count" as const),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const mapAgg = useMemo(() => {
    const map: Record<string, number> = {};
    let anyValor = false;
    for (const r of filtered) {
      if (Number(r.valor || 0) > 0) {
        anyValor = true;
        break;
      }
    }
    for (const r of filtered) {
      const key = departamento ? String(r.municipio) : String(r.departamento);
      if (!key || /^sin (departamento|municipio)$/i.test(key)) continue;
      map[key] =
        (map[key] || 0) + (anyValor ? Number(r.valor || 0) : 1);
    }
    return map;
  }, [filtered, departamento]);

  const timeSeries = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    for (const r of filtered) {
      const key = String(r.fecha).slice(0, 7);
      if (!/^\d{4}-\d{2}/.test(key)) continue;
      const cur = map.get(key) || { valor: 0, count: 0 };
      cur.valor += Number(r.valor || 0);
      cur.count += 1;
      map.set(key, cur);
    }
    const useValor = [...map.values()].some((v) => v.valor > 0);
    return [...map.entries()]
      .map(([period, v]) => ({
        period,
        value: useValor ? v.valor : v.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [filtered]);

  const heatmap = useMemo(() => {
    const months = Array.from(
      new Set(
        filtered
          .map((r) => String(r.fecha).slice(0, 7))
          .filter((m) => /^\d{4}-\d{2}/.test(m)),
      ),
    ).sort();
    const depts = Array.from(
      new Set(
        filtered
          .map((r) => String(r.departamento || "").trim())
          .filter((d) => d && !/^sin departamento$/i.test(d)),
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
    const matrix = depts.map((dept) => ({
      dept,
      cells: months.map((m) => {
        const rows = filtered.filter(
          (r) =>
            String(r.departamento) === dept &&
            String(r.fecha).startsWith(m),
        );
        const value = anyValor
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
      metric: anyValor ? ("valor" as const) : ("count" as const),
      useful: months.length > 1 && depts.length > 0 && max > 0,
    };
  }, [filtered]);

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
      setDepartamento((prev) => toggle(prev, name));
      setMunicipio("");
    } else if (column === 1) {
      setEstado((prev) => toggle(prev, name));
    } else {
      setTercero((prev) => toggle(prev, name));
    }
  }

  function onMapSelect(point: MapPoint) {
    if (point.level === "departamento") {
      setDepartamento((prev) => {
        const next = toggle(prev, point.name);
        if (!next) setMunicipio("");
        return next;
      });
    } else {
      setMunicipio((prev) => toggle(prev, point.name));
    }
  }

  function onPieClick(name: string) {
    if (pieUsesEstado) {
      setEstado((prev) => toggle(prev, name));
    } else {
      setTercero((prev) => toggle(prev, name));
    }
  }

  function onBarClick(name: string) {
    setDepartamento((prev) => toggle(prev, name));
    setMunicipio("");
  }

  function onPeriodClick(period: string) {
    setPeriodo((prev) => toggle(prev, period));
    if (periodo !== period) {
      setFrom("");
      setTo("");
    }
  }

  function onHeatmapCell(dept: string, month: string) {
    const same = departamento === dept && periodo === month;
    if (same) {
      setDepartamento("");
      setPeriodo("");
      setMunicipio("");
      return;
    }
    setDepartamento(dept);
    setMunicipio("");
    setPeriodo(month);
    setFrom("");
    setTo("");
  }

  const sqlSynced =
    !hasFilters && sqlAgg != null && sqlAgg.totals.count === records.length;

  return (
    <div
      className="min-w-0 max-w-full space-y-4 sm:space-y-5"
      id="tour-analitica"
    >
      {sourceTheme ? (
        <DecisionDashboard
          themeId={theme.id}
          themeName={theme.name}
          records={hasFilters ? filtered : workingRecords}
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

      <div className="grid min-w-0 gap-3 rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Departamento
          <select
            value={departamento}
            onChange={(e) => {
              setDepartamento(e.target.value);
              setMunicipio("");
            }}
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
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
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
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPeriodo("");
            }}
            className="mt-1 w-full max-w-full min-w-0 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          />
        </label>
        <label className="min-w-0 text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPeriodo("");
            }}
            className="mt-1 w-full max-w-full min-w-0 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          />
        </label>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-ungrd-muted sm:text-sm">
          Clic en cualquier visualización para filtrar cruzado.
        </span>
        {hasFilters && (
          <>
            {departamento && (
              <button
                type="button"
                onClick={() => {
                  setDepartamento("");
                  setMunicipio("");
                }}
                className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Depto: {departamento} ×
              </button>
            )}
            {municipio && (
              <button
                type="button"
                onClick={() => setMunicipio("")}
                className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Mpio: {municipio} ×
              </button>
            )}
            {estado && (
              <button
                type="button"
                onClick={() => setEstado("")}
                className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Estado: {estado} ×
              </button>
            )}
            {tercero && (
              <button
                type="button"
                onClick={() => setTercero("")}
                className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                {thirdLabel}: {tercero} ×
              </button>
            )}
            {periodo && (
              <button
                type="button"
                onClick={() => setPeriodo("")}
                className="max-w-full truncate rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Periodo: {periodo} ×
              </button>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-ungrd-border px-3 py-1 text-xs font-bold text-ungrd-heading hover:bg-ungrd-bg"
            >
              Limpiar todo
            </button>
          </>
        )}
      </div>

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

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Mapa geográfico · {departamento ? "Municipal" : "Departamental"}
          </h3>
          <ColombiaMap
            aggregation={mapAgg}
            selectedDepartment={departamento}
            selectedName={departamento ? municipio : departamento}
            onSelect={onMapSelect}
          />
          <p className="mt-2 text-xs text-ungrd-muted">
            Polígonos MGN DANE 2024 (depto) · puntos DIVIPOLA (municipio). Clic
            para filtrar el resto de gráficos.
          </p>
        </section>

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
            Top departamentos ({deptBarUsesValor ? "valor $" : "nº registros"})
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
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Serie de tiempo
          </h3>
          <div className="h-64 min-w-0 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeSeries}
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
                  width={44}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${Math.round(v / 1_000_000)}M`
                      : String(v)
                  }
                />
                <Tooltip formatter={(v) => formatCop(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ffd100"
                  strokeWidth={3}
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
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={active ? 6 : 3}
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
            {heatmap.metric === "valor"
              ? "Mapa de calor · valor por departamento × mes"
              : "Mapa de calor · actividad (registros) por departamento × mes"}
          </h3>
          <p className="mb-2 text-xs text-ungrd-muted">
            {heatmap.metric === "valor"
              ? "Intensidad = valor en pesos. Clic en celda para filtrar departamento y periodo."
              : "Intensidad = cantidad de gestiones/registros (útil cuando la capa no trae $). Clic para filtrar."}
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
