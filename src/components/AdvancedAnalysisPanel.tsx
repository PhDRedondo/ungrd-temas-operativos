"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  GitBranch,
  Network,
  Radius,
  Share2,
  Siren,
  Waypoints,
} from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, formatNumber, type RecordRow } from "@/lib/data";
import { buildComplexNetwork } from "@/lib/complexNetwork";
import {
  NetworkGraph,
  NETWORK_TYPE_COLORS,
  NETWORK_TYPE_LABELS,
} from "@/components/NetworkGraph";
import {
  buildDecisionBrief,
  isSourceTheme,
} from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import { aggregateSpatial } from "@/lib/geo/spatial";

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
};

function fmt(n: number, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CO", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
  });
}

export function AdvancedAnalysisPanel({ theme, records }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const source = isSourceTheme(theme.id);

  const working = useMemo(
    () => (source ? enrichRecordsForDecision(records) : records),
    [records, source],
  );

  const decision = useMemo(
    () => (source ? buildDecisionBrief(theme.id, working) : null),
    [theme.id, working, source],
  );

  const spatial = useMemo(() => aggregateSpatial(working, {}), [working]);

  const network = useMemo(
    () => buildComplexNetwork(working, theme),
    [working, theme],
  );

  const { metrics } = network;
  const selected = metrics.nodeMetrics.find((n) => n.id === selectedId);

  const cards = [
    {
      icon: Network,
      label: "Nodos",
      value: formatNumber(metrics.nodes),
      hint: "Entidades en la red",
    },
    {
      icon: Share2,
      label: "Enlaces",
      value: formatNumber(metrics.edges),
      hint: "Relaciones ponderadas",
    },
    {
      icon: Radius,
      label: "Densidad",
      value: fmt(metrics.density),
      hint: "Conectividad global",
    },
    {
      icon: Activity,
      label: "Grado medio",
      value: fmt(metrics.avgDegree, 2),
      hint: `Máx. ${metrics.maxDegree}`,
    },
    {
      icon: GitBranch,
      label: "Clustering",
      value: fmt(metrics.avgClustering),
      hint: "Triángulos locales",
    },
    {
      icon: Waypoints,
      label: "Componente gigante",
      value: `${Math.round(metrics.giantComponentShare * 100)}%`,
      hint: `${metrics.components} componente${metrics.components === 1 ? "" : "s"}`,
    },
  ];

  const topDegree = metrics.nodeMetrics.slice(0, 8);
  const topBetweenness = [...metrics.nodeMetrics]
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 8);

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-5" id="vista-avanzada">
      {decision ? (
        <section className="rounded-2xl border border-ungrd-navy/20 bg-[linear-gradient(160deg,#f7fafc_0%,#eef5fb_100%)] p-4 sm:p-5">
          <p className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
            Análisis avanzado de decisión
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-ungrd-heading">
            {decision.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ungrd-muted">
            {decision.subtitle}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {decision.kpis.map((k) => (
              <article
                key={k.id}
                className="rounded-xl border border-ungrd-border bg-white p-3"
              >
                <p className="text-[11px] font-bold tracking-wide text-ungrd-muted uppercase">
                  {k.label}
                </p>
                <p className="mt-1 text-xl font-extrabold text-ungrd-heading tabular-nums">
                  {k.value}
                </p>
                {k.hint ? (
                  <p className="mt-1 text-xs text-ungrd-muted">{k.hint}</p>
                ) : null}
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                Alertas accionables
              </h3>
              {decision.alerts.length === 0 ? (
                <p className="text-sm text-ungrd-muted">Sin alertas críticas.</p>
              ) : (
                <ul className="space-y-2">
                  {decision.alerts.slice(0, 4).map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-ungrd-border bg-white px-3 py-2.5 text-sm"
                    >
                      <p className="inline-flex items-center gap-1.5 font-extrabold text-ungrd-heading">
                        <Siren className="h-3.5 w-3.5 text-[#c62828]" />
                        {a.title}
                      </p>
                      <p className="mt-1 text-ungrd-muted">{a.detail}</p>
                      {a.action ? (
                        <p className="mt-1 text-xs font-semibold text-ungrd-navy">
                          Qué hacer: {a.action}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                Concentración territorial (top 8)
              </h3>
              <ul className="space-y-1.5">
                {spatial.areas.slice(0, 8).map((a, i) => (
                  <li
                    key={a.name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-ungrd-border bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="truncate font-semibold text-ungrd-heading">
                      {i + 1}. {a.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-ungrd-muted">
                      {spatial.metric === "valor"
                        ? formatCop(a.valor)
                        : `${formatNumber(a.count)} reg.`}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                {decision.focusLabel}
              </h3>
              <ul className="space-y-1.5">
                {decision.priorityList.slice(0, 6).map((p, i) => (
                  <li
                    key={p.key}
                    className="rounded-lg border border-ungrd-border bg-white px-3 py-1.5 text-sm"
                  >
                    <p className="font-bold text-ungrd-heading">
                      {i + 1}. {p.label}
                    </p>
                    {p.extra ? (
                      <p className="text-xs text-ungrd-muted">{p.extra}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-ungrd-navy uppercase">
              Modelo de redes complejas
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-ungrd-heading sm:text-xl">
              Red operativa multipartite
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ungrd-muted">
              Grafo construido a partir de los registros del tema: nodos de
              departamento, municipio, estado y{" "}
              {network.categoryLabel.toLowerCase()}, enlazados por co-ocurrencia.
              El tamaño del nodo refleja su frecuencia; el grosor del enlace, la
              intensidad de la relación.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(NETWORK_TYPE_LABELS) as Array<keyof typeof NETWORK_TYPE_LABELS>).map(
            (type) => (
              <span
                key={type}
                className="inline-flex items-center gap-2 rounded-full border border-ungrd-border bg-ungrd-bg px-2.5 py-1 text-[11px] font-bold text-ungrd-heading"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ background: NETWORK_TYPE_COLORS[type] }}
                />
                {NETWORK_TYPE_LABELS[type]}
              </span>
            ),
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.label}
            className="min-w-0 rounded-2xl border border-ungrd-border bg-ungrd-surface p-4"
          >
            <div className="flex items-center gap-2 text-ungrd-navy">
              <c.icon className="h-4 w-4 shrink-0" />
              <p className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
                {c.label}
              </p>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-ungrd-heading tabular-nums">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-ungrd-muted">{c.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-ungrd-heading">
                Visualización de la red
              </h3>
              <p className="text-xs text-ungrd-muted">
                Clic en un nodo para resaltar su vecindario y ver métricas.
              </p>
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-ungrd-border px-2.5 py-1 text-xs font-bold text-ungrd-heading"
              >
                Limpiar selección
              </button>
            )}
          </div>
          <NetworkGraph
            nodes={network.nodes}
            edges={network.edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="min-w-0 rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="text-sm font-extrabold text-ungrd-heading">
            Métricas del nodo
          </h3>
          {selected ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-ungrd-border bg-ungrd-bg p-3">
                <p className="text-[11px] font-bold tracking-wide text-ungrd-muted uppercase">
                  {NETWORK_TYPE_LABELS[selected.type]}
                </p>
                <p className="mt-1 text-lg font-extrabold text-ungrd-heading">
                  {selected.label}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Grado", formatNumber(selected.degree)],
                  ["Fuerza", formatNumber(selected.strength)],
                  ["C. grado", fmt(selected.degreeCentrality)],
                  ["Intermediación", fmt(selected.betweenness)],
                  ["Clustering", fmt(selected.clustering)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-ungrd-border px-3 py-2"
                  >
                    <dt className="text-[10px] font-bold tracking-wide text-ungrd-muted uppercase">
                      {k}
                    </dt>
                    <dd className="mt-0.5 font-extrabold text-ungrd-heading tabular-nums">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ungrd-muted">
              Seleccione un nodo en el grafo para inspeccionar grado, fuerza,
              centralidad de intermediación y clustering local.
            </p>
          )}

          <div className="mt-5 border-t border-ungrd-border pt-4">
            <h4 className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              Topología global
            </h4>
            <ul className="mt-2 space-y-1.5 text-sm text-ungrd-text">
              <li>
                Camino medio:{" "}
                <strong className="text-ungrd-heading">
                  {metrics.avgPathLength == null
                    ? "—"
                    : fmt(metrics.avgPathLength, 2)}
                </strong>
              </li>
              <li>
                Diámetro:{" "}
                <strong className="text-ungrd-heading">
                  {metrics.diameter == null
                    ? "—"
                    : formatNumber(metrics.diameter)}
                </strong>
              </li>
              <li>
                Relación modelo: departamento ↔ municipio ↔ estado ↔{" "}
                {network.categoryLabel.toLowerCase()}
              </li>
            </ul>
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Ranking · centralidad de grado
          </h3>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Nodo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Grado</th>
                  <th className="px-2 py-2 text-right">C.</th>
                </tr>
              </thead>
              <tbody>
                {topDegree.map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-t border-ungrd-border hover:bg-ungrd-yellow/15"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <td className="max-w-[10rem] truncate px-2 py-2 font-semibold text-ungrd-heading">
                      {n.label}
                    </td>
                    <td className="px-2 py-2 text-xs text-ungrd-muted">
                      {NETWORK_TYPE_LABELS[n.type]}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {n.degree}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmt(n.degreeCentrality)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="mb-3 text-sm font-extrabold text-ungrd-heading">
            Ranking · intermediación (betweenness)
          </h3>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Nodo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Betweenness</th>
                  <th className="px-2 py-2 text-right">Clust.</th>
                </tr>
              </thead>
              <tbody>
                {topBetweenness.map((n) => (
                  <tr
                    key={n.id}
                    className="cursor-pointer border-t border-ungrd-border hover:bg-ungrd-yellow/15"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <td className="max-w-[10rem] truncate px-2 py-2 font-semibold text-ungrd-heading">
                      {n.label}
                    </td>
                    <td className="px-2 py-2 text-xs text-ungrd-muted">
                      {NETWORK_TYPE_LABELS[n.type]}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmt(n.betweenness)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmt(n.clustering)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
