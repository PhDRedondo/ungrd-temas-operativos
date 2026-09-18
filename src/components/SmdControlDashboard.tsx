"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";
import type { UploadListItem } from "@/lib/uploads/types";
import {
  aggregateSmdControlBoard,
  corteLabelFromFileName,
  EMPTY_SMD_CONTROL_FILTERS,
  formatCompactCop,
  type SmdControlBoard,
  type SmdControlFilters,
  type SmdSubcuentaRow,
} from "@/themes/ejecucion-financiera/dashboard";

type Props = {
  records: RecordRow[];
};

const LINE_COLORS = ["#0d7377", "#f4c430", "#3d7ea6", "#c45c26", "#5a6b7d", "#1f7a4d"];

const SELECT =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-navy/15";

function moneyCell(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function pctLabel(n: number | null) {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

export function SmdControlDashboard({ records }: Props) {
  const [filters, setFilters] = useState<SmdControlFilters>(EMPTY_SMD_CONTROL_FILTERS);
  const [uploadCorte, setUploadCorte] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [subQuery, setSubQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/uploads?themeId=ejecucion-financiera", {
          cache: "no-store",
        });
        const data = await res.json();
        const list = (data.uploads || []) as UploadListItem[];
        const done = list.find((u) => u.status === "done") || list[0];
        if (!cancelled && done?.fileName) {
          setUploadName(done.fileName);
          setUploadCorte(corteLabelFromFileName(done.fileName));
        }
      } catch {
        /* el corte también sale del payload */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [records.length]);

  const board = useMemo(
    () => aggregateSmdControlBoard(records, filters),
    [records, filters],
  );

  const corte = board.corte || uploadCorte || "Corte vigente";
  const archivo = board.archivo || uploadName;
  const options = board.options;

  function patch(partial: Partial<SmdControlFilters>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function toggleSubcuenta(key: string) {
    const all = options.subcuentas.map((s) => s.key);
    if (filters.subcuentas.includes("__none__")) {
      patch({ subcuentas: [key] });
      return;
    }
    const current = filters.subcuentas.length ? filters.subcuentas : all;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    if (!next.length) {
      patch({ subcuentas: ["__none__"] });
      return;
    }
    patch({ subcuentas: next.length === all.length ? [] : next });
  }

  const subChecked = (key: string) =>
    !filters.subcuentas.includes("__none__") &&
    (filters.subcuentas.length === 0 || filters.subcuentas.includes(key));

  const visibleSubs = options.subcuentas.filter((s) => {
    const q = subQuery.trim().toLowerCase();
    if (!q) return true;
    return `${s.label} ${s.linea} ${s.code}`.toLowerCase().includes(q);
  });

  const chips: { id: string; label: string; clear: () => void }[] = [];
  if (filters.anio) chips.push({ id: "anio", label: `Año ${filters.anio}`, clear: () => patch({ anio: "" }) });
  if (filters.anioDesde) {
    chips.push({
      id: "desde",
      label: `Desde ${filters.anioDesde}`,
      clear: () => patch({ anioDesde: "" }),
    });
  }
  if (filters.resolucion) {
    chips.push({
      id: "res",
      label: `Res. ${filters.resolucion}`,
      clear: () => patch({ resolucion: "" }),
    });
  }
  if (filters.fuente) chips.push({ id: "fte", label: filters.fuente, clear: () => patch({ fuente: "" }) });
  if (filters.linea) chips.push({ id: "lin", label: filters.linea, clear: () => patch({ linea: "" }) });
  if (filters.grupo) chips.push({ id: "grp", label: filters.grupo, clear: () => patch({ grupo: "" }) });
  if (filters.estado) chips.push({ id: "est", label: filters.estado, clear: () => patch({ estado: "" }) });
  if (filters.areaEjecutora) {
    chips.push({
      id: "area",
      label: `Área ${filters.areaEjecutora}`,
      clear: () => patch({ areaEjecutora: "" }),
    });
  }
  if (filters.subcuentas.includes("__none__")) {
    chips.push({
      id: "sub",
      label: "Sin subcuentas",
      clear: () => patch({ subcuentas: [] }),
    });
  } else if (filters.subcuentas.length) {
    chips.push({
      id: "sub",
      label: `${filters.subcuentas.length} subcuentas`,
      clear: () => patch({ subcuentas: [] }),
    });
  }
  if (filters.q.trim()) {
    chips.push({
      id: "q",
      label: `Buscar “${filters.q.trim()}”`,
      clear: () => patch({ q: "" }),
    });
  }

  const pieData = board.bySubcuenta.map((r) => ({
    name: r.label.replace(/^\d+[A-Z]-/i, "").slice(0, 28),
    value: Math.max(0, r.cdp),
  })).filter((d) => d.value > 0);
  const barData = board.bySubcuenta.map((r) => ({
    name: r.label.replace(/^\d+[A-Z]-/i, "").slice(0, 18),
    pagado: r.pagado / 1e9,
    porPagar: r.porPagar / 1e9,
  }));

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-[#e8eef4] text-slate-900 shadow-[0_18px_40px_rgba(0,45,90,0.12)]"
      aria-label="Control y seguimiento SMD"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.2em] text-ungrd-navy uppercase">
            FNGRD · Control y seguimiento
          </p>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-ungrd-navy sm:text-xl">
            Ejecución por línea
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-full bg-ungrd-navy px-3 py-1 text-[11px] font-extrabold tracking-wide text-white">
            {corte}
          </p>
          <p className="text-xs font-semibold text-slate-500">
            {formatNumber(board.cdpUnicos)} CDP · {formatNumber(board.bySubcuenta.length)} líneas
            {archivo ? ` · ${archivo}` : ""}
          </p>
          <BrandLogo className="h-12 w-auto object-contain" width={72} height={84} />
        </div>
      </header>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Año">
              <select className={SELECT} value={filters.anio} onChange={(e) => patch({ anio: e.target.value })}>
                <option value="">Todos</option>
                {options.anios.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Field>
            <Field label="Resolución">
              <select className={SELECT} value={filters.resolucion} onChange={(e) => patch({ resolucion: e.target.value })}>
                <option value="">Todas</option>
                {options.resoluciones.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                ))}
              </select>
            </Field>
            <Field label="Fuente">
              <select className={SELECT} value={filters.fuente} onChange={(e) => patch({ fuente: e.target.value })}>
                <option value="">Todas</option>
                {options.fuentes.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Áreas desde">
              <select className={SELECT} value={filters.anioDesde} onChange={(e) => patch({ anioDesde: e.target.value })}>
                <option value="">Todo el histórico</option>
                {options.anios.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Field>
            <Field label="Línea">
              <select className={SELECT} value={filters.linea} onChange={(e) => patch({ linea: e.target.value })}>
                <option value="">Todas</option>
                {options.lineas.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                ))}
              </select>
            </Field>
            <Field label="Grupo">
              <select className={SELECT} value={filters.grupo} onChange={(e) => patch({ grupo: e.target.value })}>
                <option value="">Todos</option>
                {options.grupos.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select className={SELECT} value={filters.estado} onChange={(e) => patch({ estado: e.target.value })}>
                <option value="">Todos</option>
                {options.estados.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                ))}
              </select>
            </Field>
            <Field label="Área ejecutora">
              <select className={SELECT} value={filters.areaEjecutora} onChange={(e) => patch({ areaEjecutora: e.target.value })}>
                <option value="">Todas</option>
                {options.areas.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold tracking-wide text-slate-500 uppercase">
                Línea
              </p>
              <div className="flex gap-3 text-[11px] font-bold text-ungrd-navy">
                <button type="button" className="hover:underline" onClick={() => patch({ subcuentas: [] })}>
                  Todas
                </button>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => patch({ subcuentas: ["__none__"] })}
                >
                  Ninguna
                </button>
              </div>
            </div>
            <label className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <input
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                placeholder="Filtrar lista de subcuentas…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-sm">
              {visibleSubs.map((s) => (
                <li key={s.key}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-ungrd-navy"
                      checked={subChecked(s.key)}
                      onChange={() => toggleSubcuenta(s.key)}
                    />
                    <span className="leading-snug">{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <input
                value={filters.q}
                onChange={(e) => patch({ q: e.target.value })}
                placeholder="Buscar CDP, resolución, grupo…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          {chips.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={c.clear}
                  className="inline-flex items-center gap-1 rounded-full bg-ungrd-navy px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  {c.label}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                className="text-[11px] font-bold text-ungrd-navy underline-offset-2 hover:underline"
                onClick={() => {
                  setFilters(EMPTY_SMD_CONTROL_FILTERS);
                  setSubQuery("");
                }}
              >
                Limpiar todo
              </button>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col justify-between gap-3 rounded-xl bg-[#0f3a56] p-4 text-white">
          <p className="text-xs font-extrabold tracking-[0.18em] text-white/70 uppercase">
            CDP del corte
          </p>
          <p className="text-4xl font-extrabold tabular-nums tracking-tight">
            {formatCompactCop(board.cdp)}
          </p>
          <p className="text-xs leading-snug text-white/75">
            Suma de CDP SMD por línea. La apropiación se registra en el
            formulario del corte al cargar el Excel.
          </p>
        </aside>
      </div>

      <div className={`grid gap-3 px-3 sm:grid-cols-2 sm:px-4 ${board.hasApropiacion ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {board.hasApropiacion ? (
          <Kpi
            label="Apropiación disponible"
            value={formatCompactCop(board.apropiacionDisponible)}
            hint="Apropiación − CDP"
            className="bg-[#c5e86c] text-[#1a2e05]"
          />
        ) : null}
        <Kpi
          label="Compromiso"
          value={formatCompactCop(board.compromiso)}
          hint={pctOf(board.pctCompromiso, "del CDP")}
          className="bg-[#f2c14e] text-[#3b2a04]"
        />
        <Kpi
          label="Por pagar"
          value={formatCompactCop(board.porPagar)}
          hint={pctOf(board.pctPorPagar, "del CDP")}
          className="bg-[#7ec8e3] text-[#083344]"
        />
        <Kpi
          label="Pagado"
          value={formatCompactCop(board.pagado)}
          hint={pctOf(board.pctPagado, "del CDP")}
          className="bg-[#3d7ea6] text-white"
        />
      </div>

      <p className="px-4 pt-3 text-[11px] leading-relaxed text-slate-600">
        <strong className="text-ungrd-navy">Lectura:</strong> la ejecución se
        agrupa por <strong>línea</strong> del Excel SMD. Saldo por comprometer =
        CDP − compromiso · % pagado = pagado / CDP. La apropiación se captura
        en el formulario del corte (Cargar Excel), no viene del Fidusap.
      </p>

      <div className="space-y-3 p-3 sm:p-4">
        <h3 className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
          Ejecución por línea ({board.bySubcuenta.length})
        </h3>
        <LineaTable
          rows={board.bySubcuenta}
          total={board}
          showApropiacion={board.hasApropiacion}
          empty={
            records.length === 0
              ? "Suba el Excel Fidusap para ver el tablero del corte."
              : "Ninguna línea coincide con los filtros."
          }
        />
      </div>

      <div className="grid gap-3 px-3 pb-4 sm:px-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
            CDP por línea
          </h3>
          <div className="h-64">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={1}
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={LINE_COLORS[i % LINE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCop(v)} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Sin CDP en este filtro.
              </p>
            )}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
            Pagado y por pagar por línea
          </h3>
          <p className="text-[11px] text-slate-500">Miles de millones de pesos del corte SMD</p>
          <div className="h-60">
            {barData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8e0e8" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}`} width={36} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${Number(v).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`,
                      name,
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pagado" name="Pagado" fill="#3d7ea6" isAnimationActive={false} />
                  <Bar dataKey="porPagar" name="Por pagar" fill="#7ec8e3" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Sin líneas en este filtro.
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function LineaTable({
  rows,
  total,
  empty,
  showApropiacion,
}: {
  rows: SmdSubcuentaRow[];
  total: SmdControlBoard;
  empty: string;
  showApropiacion: boolean;
}) {
  const cols = showApropiacion ? 9 : 7;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[72rem] w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-20 bg-ungrd-navy text-[10px] font-bold tracking-wide text-white uppercase">
          <tr>
            <th className="sticky left-0 z-30 bg-ungrd-navy px-3 py-2.5">Línea</th>
            {showApropiacion ? (
              <th className="bg-[#1b4f72] px-3 py-2.5 text-right">Apropiación</th>
            ) : null}
            <th className="px-3 py-2.5 text-right">CDP</th>
            {showApropiacion ? (
              <th className="bg-[#2d6a4f] px-3 py-2.5 text-right">Apropiación disponible</th>
            ) : null}
            <th className="px-3 py-2.5 text-right">Compromiso</th>
            <th className="bg-[#7a6400] px-3 py-2.5 text-right">Saldo por comprometer</th>
            <th className="px-3 py-2.5 text-right">Pagado</th>
            <th className="px-3 py-2.5 text-right">Por pagar</th>
            <th className="px-3 py-2.5 text-right">% Pagado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols} className="px-3 py-8 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-semibold text-ungrd-navy shadow-[2px_0_6px_rgba(15,58,86,0.08)]">
                  {row.label}
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                    {row.cdpCount} CDP
                    {row.linea && row.linea !== row.label ? ` · ${row.linea}` : ""}
                  </span>
                </td>
                {showApropiacion ? (
                  <td className="bg-sky-50 px-3 py-2 text-right tabular-nums">
                    {row.cupoFormulario ? moneyCell(row.apropiacion) : "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2 text-right tabular-nums">{moneyCell(row.cdp)}</td>
                {showApropiacion ? (
                  <td className="bg-emerald-50 px-3 py-2 text-right font-semibold tabular-nums text-emerald-900">
                    {row.cupoFormulario ? moneyCell(row.apropiacionDisponible) : "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2 text-right tabular-nums">{moneyCell(row.compromiso)}</td>
                <td className="bg-[#fff3b0] px-3 py-2 text-right font-bold tabular-nums">
                  {moneyCell(row.saldoPorComprometer)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyCell(row.pagado)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyCell(row.porPagar)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{pctLabel(row.pctPagado)}</td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="border-t-2 border-ungrd-navy bg-slate-100 font-extrabold">
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2.5">Total</td>
              {showApropiacion ? (
                <td className="bg-sky-100 px-3 py-2.5 text-right tabular-nums">
                  {moneyCell(total.apropiacion)}
                </td>
              ) : null}
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyCell(total.cdp)}</td>
              {showApropiacion ? (
                <td className="bg-emerald-100 px-3 py-2.5 text-right tabular-nums">
                  {moneyCell(total.apropiacionDisponible)}
                </td>
              ) : null}
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyCell(total.compromiso)}</td>
              <td className="bg-[#ffe566] px-3 py-2.5 text-right tabular-nums">
                {moneyCell(total.saldoPorComprometer)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyCell(total.pagado)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyCell(total.porPagar)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{pctLabel(total.pctPagado)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function pctOf(n: number | null, of = "de la apropiación") {
  return n == null ? "—" : `${n.toFixed(1)}% ${of}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
      {label}
      <span className="mt-1 block font-semibold normal-case">{children}</span>
    </label>
  );
}

function Kpi({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  className: string;
}) {
  return (
    <article className={`rounded-xl px-4 py-3 shadow-sm ${className}`}>
      <p className="text-[11px] font-extrabold tracking-wide uppercase opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] font-semibold opacity-75">{hint}</p>
    </article>
  );
}
