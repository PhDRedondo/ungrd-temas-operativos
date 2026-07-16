"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
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
import { formatCop, formatNumber, type RecordRow } from "@/lib/data";
import { departmentNames } from "@/lib/geo";
import { SankeyFlowDiagram } from "@/components/SankeyFlowDiagram";
import { RecordsDataTable } from "@/components/RecordsDataTable";
import type { MapPoint } from "@/components/ColombiaMap";

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

function toggle(current: string, next: string) {
  return current === next ? "" : next;
}

export function AnalyticsPanel({ theme, records }: Props) {
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [tercero, setTercero] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const categoryField = theme.fields.find(
    (f) =>
      f.type === "select" &&
      !["departamento", "estado"].includes(f.name),
  );
  const pieUsesEstado = !categoryField;
  const thirdKey = categoryField?.name || "municipio";
  const thirdLabel = categoryField?.label || "Municipio";

  const filtered = useMemo(() => {
    return records.filter((r) => {
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
    records,
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
    const depts = new Set(filtered.map((r) => r.departamento)).size;
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
  }, [filtered, theme.valueLabel]);

  const byEstado = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(String(r.estado), (map.get(String(r.estado)) || 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = String(r.departamento);
      map.set(key, (map.get(key) || 0) + Number(r.valor || 0));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const mapAgg = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      const key = departamento ? String(r.municipio) : String(r.departamento);
      map[key] = (map[key] || 0) + Number(r.valor || 1);
    }
    return map;
  }, [filtered, departamento]);

  const timeSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = String(r.fecha).slice(0, 7);
      map.set(key, (map.get(key) || 0) + Number(r.valor || 0));
    }
    return [...map.entries()]
      .map(([period, value]) => ({ period, value }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [filtered]);

  const sankeyRecords = useMemo(
    () =>
      filtered.map((r) => ({
        departamento: String(r.departamento),
        estado: String(r.estado),
        tercero: String(r[thirdKey] || "N/D"),
      })),
    [filtered, thirdKey],
  );

  const heatmap = useMemo(() => {
    const months = Array.from(
      new Set(filtered.map((r) => String(r.fecha).slice(0, 7))),
    ).sort();
    const depts = Array.from(
      new Set(filtered.map((r) => String(r.departamento))),
    ).slice(0, 8);
    const matrix = depts.map((dept) => ({
      dept,
      cells: months.map((m) => {
        const value = filtered
          .filter(
            (r) =>
              String(r.departamento) === dept &&
              String(r.fecha).startsWith(m),
          )
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        return { month: m, value };
      }),
    }));
    const max = Math.max(
      ...matrix.flatMap((row) => row.cells.map((c) => c.value)),
      1,
    );
    return { months, matrix, max };
  }, [filtered]);

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

  return (
    <div className="space-y-5" id="tour-analitica">
      <div className="grid gap-3 rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 md:grid-cols-4">
        <label className="text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Departamento
          <select
            value={departamento}
            onChange={(e) => {
              setDepartamento(e.target.value);
              setMunicipio("");
            }}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          >
            <option value="">Todos</option>
            {departmentNames().map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          >
            <option value="">Todos</option>
            {["Programado", "En ejecución", "Finalizado", "Suspendido"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPeriodo("");
            }}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          />
        </label>
        <label className="text-xs font-bold tracking-wide text-ungrd-heading uppercase">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPeriodo("");
            }}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-semibold text-ungrd-text normal-case"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ungrd-muted">
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
                className="rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Depto: {departamento} ×
              </button>
            )}
            {municipio && (
              <button
                type="button"
                onClick={() => setMunicipio("")}
                className="rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Mpio: {municipio} ×
              </button>
            )}
            {estado && (
              <button
                type="button"
                onClick={() => setEstado("")}
                className="rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                Estado: {estado} ×
              </button>
            )}
            {tercero && (
              <button
                type="button"
                onClick={() => setTercero("")}
                className="rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
              >
                {thirdLabel}: {tercero} ×
              </button>
            )}
            {periodo && (
              <button
                type="button"
                onClick={() => setPeriodo("")}
                className="rounded-full bg-ungrd-navy px-3 py-1 text-xs font-bold text-white"
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <article
            key={c.label}
            className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4"
          >
            <p className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-ungrd-heading">
              {c.value}
            </p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
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
            Clic en un punto para filtrar. Con departamento activo verá
            municipios.
          </p>
        </section>

        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Distribución · {categoryField?.label || "Estado"}
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
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

        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Top departamentos (valor)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v) => formatCop(Number(v))} />
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

        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Serie de tiempo
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={timeSeries}
                onClick={(state) => {
                  const label = state?.activeLabel;
                  if (typeof label === "string") onPeriodClick(label);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
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

        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 xl:col-span-2">
          <SankeyFlowDiagram
            records={sankeyRecords}
            thirdLabel={thirdLabel}
            onNodeClick={onSankeyNodeClick}
            activeFilters={{ departamento, estado, tercero }}
          />
        </section>

        <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 xl:col-span-2">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Tabla de calor · Departamento × Mes
          </h3>
          <p className="mb-2 text-xs text-ungrd-muted">
            Clic en una celda para filtrar por departamento y periodo; clic en
            el nombre del departamento o el mes para filtrar solo esa dimensión.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left font-bold text-ungrd-heading">
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
                        {m}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.matrix.map((row) => (
                  <tr key={row.dept}>
                    <td
                      className="cursor-pointer whitespace-nowrap px-2 py-1.5 font-semibold text-ungrd-heading hover:underline"
                      onClick={() => onBarClick(row.dept)}
                    >
                      <span
                        className={
                          departamento === row.dept
                            ? "rounded bg-ungrd-yellow px-1 text-ungrd-navy-deep"
                            : undefined
                        }
                      >
                        {row.dept}
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
                            title={`${row.dept} · ${cell.month}: ${formatCop(cell.value)}`}
                            onClick={() =>
                              onHeatmapCell(row.dept, cell.month)
                            }
                            className="flex h-8 min-w-14 w-full items-center justify-center rounded-md text-[10px] font-bold transition hover:ring-2 hover:ring-ungrd-yellow"
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
                              ? `${Math.round(cell.value / 1_000_000)}M`
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

        <RecordsDataTable theme={theme} records={filtered} />
      </div>
    </div>
  );
}
