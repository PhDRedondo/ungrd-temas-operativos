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
    return "La operación está concentrada en pocas combinaciones territorio–estado–capa (poco dispersa).";
  if (d < 0.2)
    return "Hay patrones claros: algunos territorios y estados se repiten juntos con frecuencia.";
  return "La operación está muy repartida entre muchas combinaciones; hay que priorizar con filtros.";
}

function interpretNode(
  type: string,
  degree: number,
  betweenness: number,
  label: string,
) {
  const tipo = NETWORK_TYPE_LABELS[type as keyof typeof NETWORK_TYPE_LABELS] || type;
  if (betweenness >= 0.25) {
    return `${label} (${tipo}) actúa como puente: conecta varios territorios/estados/capas. Si se atrasa aquí, se siente en toda la operación.`;
  }
  if (degree >= 15) {
    return `${label} (${tipo}) es un centro de actividad: aparece junto a muchas otras piezas. Conviene seguimiento cercano.`;
  }
  if (degree >= 6) {
    return `${label} (${tipo}) tiene actividad intermedia: revise con qué estados y capas se combina.`;
  }
  return `${label} (${tipo}) tiene pocas conexiones visibles en la muestra actual.`;
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

  const topHubs = metrics.nodeMetrics.slice(0, 8);
  const topBridges = [...metrics.nodeMetrics]
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 8);

  const insights = useMemo(() => {
    const out: { title: string; detail: string; action: string }[] = [];
    const hub = topHubs[0];
    if (hub) {
      out.push({
        title: `Centro de actividad: ${hub.label}`,
        detail: `Es el ${NETWORK_TYPE_LABELS[hub.type].toLowerCase()} que más se combina con otros (aparece en ${formatNumber(hub.degree)} relaciones distintas).`,
        action:
          hub.type === "departamento" || hub.type === "municipio"
            ? "Priorice visitas, carga de bitácora y verificación en ese territorio."
            : hub.type === "estado"
              ? "Revise el cuello de botella de ese estado y las claves atrapadas ahí."
              : "Revise esa capa/categoría: concentra buena parte del flujo operativo.",
      });
    }
    const bridge = topBridges[0];
    if (bridge && bridge.id !== hub?.id && bridge.betweenness > 0.05) {
      out.push({
        title: `Puente operativo: ${bridge.label}`,
        detail: `Conecta partes distintas de la operación (territorio ↔ estado ↔ ${network.categoryLabel.toLowerCase()}).`,
        action:
          "Si este nodo falla o se atrasa, impacta a varios frentes a la vez: asígnelo a un responsable.",
      });
    }
    out.push({
      title: "Cómo leer el mapa de red",
      detail: interpretDensity(metrics.density),
      action:
        "Use el clic en un nodo para ver con qué se relaciona. Luego filtre ese territorio/estado en el Centro de mando.",
    });
    if (metrics.giantComponentShare < 0.95) {
      out.push({
        title: "Hay operaciones desconectadas",
        detail: `Solo el ${Math.round(metrics.giantComponentShare * 100)}% está en un solo bloque conectado.`,
        action:
          "Revise registros sin departamento/municipio o estados aislados que no se cruzan con el resto.",
      });
    }
    return out.slice(0, 4);
  }, [topHubs, topBridges, metrics.density, metrics.giantComponentShare, network.categoryLabel]);

  const cards = [
    {
      icon: MapPinned,
      label: "Piezas en juego",
      value: formatNumber(metrics.nodes),
      hint: `Territorios, estados y ${network.categoryLabel.toLowerCase()} que aparecen en los datos`,
    },
    {
      icon: Waypoints,
      label: "Cruces detectados",
      value: formatNumber(metrics.edges),
      hint: "Cuántas veces esas piezas aparecen juntas en un mismo registro",
    },
    {
      icon: Target,
      label: "Concentración",
      value: metrics.density < 0.1 ? "Alta" : metrics.density < 0.2 ? "Media" : "Baja",
      hint: interpretDensity(metrics.density),
    },
    {
      icon: Activity,
      label: "Conexiones promedio",
      value: fmt(metrics.avgDegree, 1),
      hint: `Cada pieza se relaciona, en promedio, con ${fmt(metrics.avgDegree, 1)} otras (máx. ${metrics.maxDegree})`,
    },
    {
      icon: Network,
      label: "Operación unida",
      value: `${Math.round(metrics.giantComponentShare * 100)}%`,
      hint:
        metrics.giantComponentShare >= 0.95
          ? "Todo se conecta en un solo bloque (buena trazabilidad cruzada)"
          : "Hay islas: algunos registros no se cruzan con el resto",
    },
    {
      icon: HelpCircle,
      label: "Modelo",
      value: "4 capas",
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
          {/* Alertas a ancho completo; listas densas abajo en 2 cols.
              Evita el hueco cuando hay 1 alerta frente a 2 bloques altos. */}
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                Alertas accionables
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
                          Qué hacer: {a.action}
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

      {/* Guía clara: para qué sirve */}
      <section className="rounded-2xl border border-ungrd-navy/25 bg-ungrd-navy p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.2em] text-ungrd-yellow uppercase">
              Análisis avanzado · {theme.name}
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              ¿Qué estamos analizando aquí?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/80">
              No es un grafo “por lucirse”. Cruzamos{" "}
              <strong className="text-white">territorio</strong> (depto/municipio),{" "}
              <strong className="text-white">estado</strong> del trámite y{" "}
              <strong className="text-white">
                {network.categoryLabel.toLowerCase()}
              </strong>{" "}
              (capa/tipo) cuando aparecen juntos en los mismos registros. Sirve
              para ver <em>dónde se concentra</em> la operación y{" "}
              <em>qué estados o capas hacen de puente</em> entre territorios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
          >
            {showHelp ? "Ocultar guía" : "Ver guía"}
          </button>
        </div>
        {showHelp ? (
          <ol className="mt-4 grid gap-2 text-sm text-white/85 sm:grid-cols-3">
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">1 · Pregunta</p>
              <p className="mt-1">
                ¿Qué departamentos, estados y capas se repiten juntos?
              </p>
            </li>
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">2 · Hallazgo</p>
              <p className="mt-1">
                Centros de actividad (mucho volumen) y puentes (si se traban,
                afectan a varios frentes).
              </p>
            </li>
            <li className="rounded-xl bg-white/10 px-3 py-3">
              <p className="font-extrabold text-ungrd-yellow">3 · Acción</p>
              <p className="mt-1">
                Clic en un nodo → vea vecinos → vaya al Centro de mando y filtre
                ese territorio o estado.
              </p>
            </li>
          </ol>
        ) : null}
      </section>

      <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <h3 className="text-sm font-extrabold text-ungrd-heading">
          Lectura rápida (en español claro)
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
                Qué hacer: {ins.action}
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
                Mapa de relaciones operativas
              </h3>
              <p className="text-xs text-ungrd-muted">
                Nodo grande = aparece mucho. Línea gruesa = se combinan seguido.
                Clic para ver con qué se relaciona.
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
            Ficha del elemento seleccionado
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
                    "Con cuántos se relaciona",
                    formatNumber(selected.degree),
                    "Antes: grado",
                  ],
                  [
                    "Fuerza del vínculo",
                    formatNumber(selected.strength),
                    "Suma de veces que aparece junto a otros",
                  ],
                  [
                    "Rol de puente",
                    selected.betweenness >= 0.25
                      ? "Alto"
                      : selected.betweenness >= 0.1
                        ? "Medio"
                        : "Bajo",
                    `Índice técnico: ${fmt(selected.betweenness)}`,
                  ],
                  [
                    "Grupo local",
                    selected.clustering >= 0.4
                      ? "Compacto"
                      : selected.clustering >= 0.15
                        ? "Mixto"
                        : "Abierto",
                    `Clustering: ${fmt(selected.clustering)}`,
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
              Seleccione un territorio, estado o capa en el mapa. Le diremos en
              lenguaje claro si es un centro de actividad o un puente operativo.
            </p>
          )}
        </section>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="text-sm font-extrabold text-ungrd-heading">
            Dónde se concentra la actividad
          </h3>
          <p className="mt-1 mb-3 text-xs text-ungrd-muted">
            Piezas que más se combinan con otras (centros). Útil para priorizar
            territorio, estado o capa.
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Elemento</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Relaciones</th>
                  <th className="px-2 py-2 text-right">Lectura</th>
                </tr>
              </thead>
              <tbody>
                {topHubs.map((n) => (
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
                      {n.degree >= 15
                        ? "Centro"
                        : n.degree >= 8
                          ? "Alto"
                          : "Medio"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4">
          <h3 className="text-sm font-extrabold text-ungrd-heading">
            Qué hace de puente (si se traba, duele)
          </h3>
          <p className="mt-1 mb-3 text-xs text-ungrd-muted">
            Elementos que unen varios frentes. Si fallan, el impacto se siente en
            más de un territorio o estado.
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Elemento</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2 text-right">Rol puente</th>
                  <th className="px-2 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {topBridges.map((n) => (
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
                    <td className="px-2 py-2 text-right text-xs font-bold text-ungrd-navy">
                      {n.betweenness >= 0.25
                        ? "Crítico"
                        : n.betweenness >= 0.1
                          ? "Alto"
                          : "Bajo"}
                    </td>
                    <td className="px-2 py-2 text-right text-[11px] text-ungrd-muted">
                      Asignar responsable
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
          Nota técnica (opcional para analistas)
        </summary>
        <p className="mt-2 leading-relaxed">
          Debajo usamos un grafo de co-ocurrencia (departamento ↔ municipio ↔
          estado ↔ {network.categoryLabel.toLowerCase()}). Densidad{" "}
          {fmt(metrics.density)}, clustering {fmt(metrics.avgClustering)}, camino
          medio{" "}
          {metrics.avgPathLength == null ? "—" : fmt(metrics.avgPathLength, 2)},
          diámetro{" "}
          {metrics.diameter == null ? "—" : formatNumber(metrics.diameter)}. Los
          rankings de arriba son grado e intermediación (betweenness) traducidos
          a lenguaje operativo.
        </p>
      </details>
    </div>
  );
}
