"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  HelpCircle,
  MapPinned,
  Network,
  Siren,
  Target,
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

function interpretDensity(d: number) {
  if (d < 0.08)
    return "Densidad baja: pocas combinaciones territorio–estado–capa respecto al máximo posible.";
  if (d < 0.2)
    return "Densidad media: hay patrones recurrentes de coocurrencia en los registros.";
  return "Densidad alta: muchas combinaciones distintas; conviene filtrar por territorio o estado.";
}

function interpretNode(
  type: string,
  degree: number,
  betweenness: number,
  label: string,
) {
  const tipo =
    NETWORK_TYPE_LABELS[type as keyof typeof NETWORK_TYPE_LABELS] || type;
  if (betweenness >= 0.25) {
    return `${label} (${tipo}): intermediación alta. Aparece en caminos entre muchos pares de nodos; un retraso o ausencia de dato aquí afecta la trazabilidad cruzada.`;
  }
  if (degree >= 15) {
    return `${label} (${tipo}): grado alto. Coocurre con ${formatNumber(degree)} entidades distintas en la muestra.`;
  }
  if (degree >= 6) {
    return `${label} (${tipo}): grado intermedio (${formatNumber(degree)} relaciones). Revise con qué estados y capas coocurre.`;
  }
  return `${label} (${tipo}): grado bajo en la muestra actual (${formatNumber(degree)} relaciones).`;
}

function betweennessLevel(b: number) {
  if (b >= 0.25) return "Alta";
  if (b >= 0.1) return "Media";
  return "Baja";
}

function degreeLevel(d: number) {
  if (d >= 15) return "Alto";
  if (d >= 8) return "Medio-alto";
  return "Medio";
}

export function AdvancedAnalysisPanel({ theme, records }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(true);
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

  const topByDegree = metrics.nodeMetrics.slice(0, 8);
  const topByBetweenness = [...metrics.nodeMetrics]
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 8);

  const insights = useMemo(() => {
    const out: { title: string; detail: string; action: string }[] = [];
    const hub = topByDegree[0];
    if (hub) {
      out.push({
        title: `Mayor grado: ${hub.label}`,
        detail: `${NETWORK_TYPE_LABELS[hub.type]} con ${formatNumber(hub.degree)} relaciones distintas (coocurrencias con otros nodos).`,
        action:
          hub.type === "departamento" || hub.type === "municipio"
            ? "Priorizar seguimiento y verificación de bitácora en ese territorio."
            : hub.type === "estado"
              ? "Revisar claves en ese estado y tiempos de gestión asociados."
              : `Revisar registros de esa ${network.categoryLabel.toLowerCase()}.`,
      });
    }
    const bridge = topByBetweenness[0];
    if (bridge && bridge.id !== hub?.id && bridge.betweenness > 0.05) {
      out.push({
        title: `Mayor intermediación: ${bridge.label}`,
        detail: `${NETWORK_TYPE_LABELS[bridge.type]} con betweenness ${fmt(bridge.betweenness)}. Une trayectorias entre territorio, estado y ${network.categoryLabel.toLowerCase()}.`,
        action:
          "Incluir en seguimiento prioritario: su retraso o vacío de dato degrada la lectura cruzada.",
      });
    }
    out.push({
      title: "Densidad de la red",
      detail: interpretDensity(metrics.density),
      action:
        "Seleccione un nodo en el grafo y filtre ese territorio o estado en el Centro de mando.",
    });
    if (metrics.giantComponentShare < 0.95) {
      out.push({
        title: "Componente conexa incompleta",
        detail: `El ${Math.round(metrics.giantComponentShare * 100)}% de nodos está en la componente principal; el resto queda aislado o en subcomponentes.`,
        action:
          "Revisar registros sin departamento/municipio o estados que no coocurren con el resto.",
      });
    }
    return out.slice(0, 4);
  }, [
    topByDegree,
    topByBetweenness,
    metrics.density,
    metrics.giantComponentShare,
    network.categoryLabel,
  ]);

  const cards = [
    {
      icon: MapPinned,
      label: "Nodos",
      value: formatNumber(metrics.nodes),
      hint: `Entidades: territorio, estado y ${network.categoryLabel.toLowerCase()}`,
    },
    {
      icon: Waypoints,
      label: "Aristas",
      value: formatNumber(metrics.edges),
      hint: "Coocurrencias entre nodos en el mismo registro",
    },
    {
      icon: Target,
      label: "Densidad",
      value: fmt(metrics.density),
      hint: interpretDensity(metrics.density),
    },
    {
      icon: Activity,
      label: "Grado medio",
      value: fmt(metrics.avgDegree, 1),
      hint: `Promedio de relaciones por nodo (máx. ${metrics.maxDegree})`,
    },
    {
      icon: Network,
      label: "Componente principal",
      value: `${Math.round(metrics.giantComponentShare * 100)}%`,
      hint:
        metrics.giantComponentShare >= 0.95
          ? "Casi todos los nodos están en una sola componente conexa"
          : "Existen nodos o subcomponentes desconectados",
    },
    {
      icon: HelpCircle,
      label: "Capas del modelo",
      value: "4",
      hint: `Departamento → municipio → estado → ${network.categoryLabel.toLowerCase()}`,
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-5" id="vista-avanzada">
      {decision ? (
        <section className="rounded-2xl border border-ungrd-navy/20 bg-[linear-gradient(160deg,#f7fafc_0%,#eef5fb_100%)] p-4 sm:p-5">
          <p className="text-xs font-extrabold tracking-[0.18em] text-ungrd-navy uppercase">
            Lectura ejecutiva del tema
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
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                Alertas
              </h3>
              {decision.alerts.length === 0 ? (
                <p className="text-sm text-ungrd-muted">Sin alertas críticas.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {decision.alerts.slice(0, 4).map((a) => (
                    <li
                      key={a.id}
                      className="rounded-xl border border-ungrd-border bg-white px-3 py-2.5 text-sm"
                    >
                      <p className="inline-flex items-center gap-1.5 font-extrabold text-ungrd-heading">
                        <Siren className="h-3.5 w-3.5 shrink-0 text-[#c62828]" />
                        {a.title}
                      </p>
                      <p className="mt-1 text-ungrd-muted">{a.detail}</p>
                      {a.action ? (
                        <p className="mt-1 text-xs font-semibold text-ungrd-navy">
                          Acción: {a.action}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-2">
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
              </div>
              <div>
                <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
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
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-ungrd-navy/25 bg-ungrd-navy p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.2em] text-ungrd-yellow uppercase">
              Análisis de red · {theme.name}
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Red de coocurrencia operativa
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/80">
              Grafo construido a partir de registros: se enlazan{" "}
              <strong className="text-white">departamento</strong>,{" "}
              <strong className="text-white">municipio</strong>,{" "}
              <strong className="text-white">estado</strong> y{" "}
              <strong className="text-white">
                {network.categoryLabel.toLowerCase()}
              </strong>{" "}
              cuando coocurren en la misma fila. Permite medir grado
              (conectividad local) e intermediación (betweenness) sobre la
              muestra cargada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
          >
            {showHelp ? "Ocultar método" : "Ver método"}
          </button>
        </div>
        {showHelp ? (
          <ol className="mt-4 grid gap-2 text-sm text-white/85 sm:grid-cols-3">
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">1 · Entrada</p>
              <p className="mt-1">
                Cada registro aporta aristas entre sus valores de territorio,
                estado y capa.
              </p>
            </li>
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">2 · Métricas</p>
              <p className="mt-1">
                Grado = número de vecinos. Intermediación = fracción de caminos
                más cortos que pasan por el nodo.
              </p>
            </li>
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">3 · Uso</p>
              <p className="mt-1">
                Seleccione un nodo, revise vecinos y filtre ese valor en el
                Centro de mando.
              </p>
            </li>
          </ol>
        ) : null}
      </section>

      <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <h3 className="text-sm font-extrabold text-ungrd-heading">
          Hallazgos (muestra actual)
        </h3>
        <ul className="mt-3 space-y-2">
          {insights.map((ins) => (
            <li
              key={ins.title}
              className="rounded-xl border border-l-4 border-ungrd-border border-l-ungrd-navy bg-ungrd-bg/40 px-4 py-3"
            >
              <p className="font-extrabold text-ungrd-heading">{ins.title}</p>
              <p className="mt-1 text-sm text-ungrd-muted">{ins.detail}</p>
              <p className="mt-1.5 text-sm font-semibold text-ungrd-navy">
                Acción: {ins.action}
              </p>
            </li>
          ))}
        </ul>
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
            <p className="mt-1 text-xs leading-snug text-ungrd-muted">{c.hint}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 px-1">
        {(
          Object.keys(NETWORK_TYPE_LABELS) as Array<
            keyof typeof NETWORK_TYPE_LABELS
          >
        ).map((type) => (
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
        ))}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-ungrd-heading">
                Grafo de coocurrencia
              </h3>
              <p className="text-xs text-ungrd-muted">
                Tamaño del nodo ∝ grado. Grosor de arista ∝ peso de
                coocurrencia. Clic para inspeccionar.
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
            Nodo seleccionado
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
                <p className="mt-2 text-sm leading-relaxed text-ungrd-muted">
                  {interpretNode(
                    selected.type,
                    selected.degree,
                    selected.betweenness,
                    selected.label,
                  )}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  [
                    "Grado",
                    formatNumber(selected.degree),
                    "Número de nodos vecinos",
                  ],
                  [
                    "Fuerza",
                    formatNumber(selected.strength),
                    "Suma de pesos de aristas incidentes",
                  ],
                  [
                    "Intermediación",
                    betweennessLevel(selected.betweenness),
                    `Betweenness: ${fmt(selected.betweenness)}`,
                  ],
                  [
                    "Clustering",
                    fmt(selected.clustering),
                    "Coeficiente de agrupamiento local",
                  ],
                ].map(([k, v, tip]) => (
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
                    <dd className="mt-0.5 text-[10px] text-ungrd-muted">{tip}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ungrd-muted">
              Seleccione un nodo en el grafo para ver grado, fuerza,
              intermediación y clustering.
            </p>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="text-sm font-extrabold text-ungrd-heading">
            Ranking por grado
          </h3>
          <p className="mt-1 mb-3 text-xs text-ungrd-muted">
            Nodos con más vecinos (mayor coocurrencia con otras entidades).
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Nodo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Grado</th>
                  <th className="px-2 py-2 text-right">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {topByDegree.map((n) => (
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
                    <td className="px-2 py-2 text-right text-xs font-bold text-ungrd-navy">
                      {degreeLevel(n.degree)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="text-sm font-extrabold text-ungrd-heading">
            Ranking por intermediación
          </h3>
          <p className="mt-1 mb-3 text-xs text-ungrd-muted">
            Nodos con mayor betweenness: aparecen con más frecuencia en caminos
            cortos entre pares de nodos.
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Nodo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Betweenness</th>
                  <th className="px-2 py-2 text-right">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {topByBetweenness.map((n) => (
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
                    <td className="px-2 py-2 text-right tabular-nums text-xs">
                      {fmt(n.betweenness)}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-ungrd-navy">
                      {betweennessLevel(n.betweenness)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-ungrd-border bg-ungrd-bg/40 px-4 py-3 text-xs text-ungrd-muted">
        <summary className="cursor-pointer font-bold text-ungrd-heading">
          Parámetros del modelo
        </summary>
        <p className="mt-2 leading-relaxed">
          Red no dirigida de coocurrencia: departamento ↔ municipio ↔ estado ↔{" "}
          {network.categoryLabel.toLowerCase()}. Densidad {fmt(metrics.density)};
          clustering medio {fmt(metrics.avgClustering)}; camino medio{" "}
          {metrics.avgPathLength == null ? "—" : fmt(metrics.avgPathLength, 2)};
          diámetro{" "}
          {metrics.diameter == null ? "—" : formatNumber(metrics.diameter)}.
          Rankings: grado (degree) e intermediación (betweenness centrality).
        </p>
      </details>
    </div>
  );
}
