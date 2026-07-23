/**
 * Semántica del mapa por tema: qué mide la coropleta y cómo se etiqueta.
 * Evita el genérico "Intensidad" y el Auto que fuerza $ en inventarios (p. ej. Puentes).
 */
import type { MapMetric } from "@/lib/geo/spatial";

export type ThemeMapSemantics = {
  /** Métrica por defecto del modo Auto */
  defaultMetric: MapMetric;
  /** Título corto de leyenda (reemplaza "Intensidad") */
  legendTitle: (metric: MapMetric) => string;
  /** Chip superior del mapa */
  metricLabel: (metric: MapMetric) => string;
  /** Pie de leyenda */
  legendHint: (metric: MapMetric) => string;
  /** Etiquetas de los botones Auto / Valor / Conteo */
  toggleValor: string;
  toggleCount: string;
  /** Texto tooltip principal */
  tooltipPrimary: (metric: MapMetric) => string;
  /** Heatmap */
  heatmapTitle: (metric: MapMetric) => string;
  heatmapHint: (metric: MapMetric) => string;
};

type ThemeLike = {
  id: string;
  name: string;
  unit: string;
  valueLabel: string;
};

/** Temas cuya realidad principal es dinero (COP). */
const MONEY_PRIMARY = new Set([
  "fic",
  "presupuesto",
  "ejecucion-financiera",
]);

/** Temas cuya realidad principal es inventario / conteo de activos o actos. */
const COUNT_PRIMARY = new Set([
  "puentes",
  "carrotanques",
  "banco-de-maquinaria",
  "declaratoria-de-emergencia",
  "obras-por-impuestos",
  "alertas-tempranas",
  "asistencia-humanitaria",
  "asistencia-tecnica",
  "convenios",
  "equipo-de-respuesta",
  "gestion-de-servicios",
  "materiales",
  "subsidios-de-arriendos",
]);

/** Etiquetas específicas de las 8 bases oficiales (+ fallback). */
const SOURCE_LABELS: Record<
  string,
  { valor: string; count: string; unit: string }
> = {
  fic: {
    valor: "Valor transferencias (COP)",
    count: "Nº CDP / transferencias",
    unit: "transferencias",
  },
  "agua-y-saneamiento": {
    valor: "Valor órdenes (COP)",
    count: "Nº órdenes de proveeduría",
    unit: "órdenes",
  },
  carrotanques: {
    valor: "Valor asociado (COP)",
    count: "Nº carrotanques",
    unit: "carrotanques",
  },
  "banco-de-maquinaria": {
    valor: "Valor asociado (COP)",
    count: "Nº equipos",
    unit: "equipos",
  },
  "obras-de-emergencia": {
    valor: "Valor obras (COP)",
    count: "Nº obras",
    unit: "obras",
  },
  "obras-por-impuestos": {
    valor: "Valor proyectos (COP)",
    count: "Nº proyectos",
    unit: "proyectos",
  },
  puentes: {
    valor: "Valor (COP)",
    count: "Nº puentes",
    unit: "puentes",
  },
  "declaratoria-de-emergencia": {
    valor: "Valor asociado (COP)",
    count: "Nº declaratorias",
    unit: "declaratorias",
  },
};

function looksLikeMoneyLabel(valueLabel: string) {
  return /\bCOP\b|pesos|presupuesto|ejecut|transferenc|\$/i.test(valueLabel);
}

export function getThemeMapSemantics(theme: ThemeLike): ThemeMapSemantics {
  const labels = SOURCE_LABELS[theme.id] || {
    valor: looksLikeMoneyLabel(theme.valueLabel)
      ? theme.valueLabel
      : `${theme.valueLabel} (COP)`,
    count: `Nº ${theme.unit || "registros"}`,
    unit: theme.unit || "registros",
  };

  const defaultMetric: MapMetric = MONEY_PRIMARY.has(theme.id)
    ? "valor"
    : COUNT_PRIMARY.has(theme.id)
      ? "count"
      : looksLikeMoneyLabel(theme.valueLabel)
        ? "valor"
        : "count";

  // Agua y obras de emergencia: si hay $, el Auto puede preferir valor
  // (lo decide el panel con datos); aquí dejamos default sensato.
  const resolvedDefault: MapMetric =
    theme.id === "agua-y-saneamiento" || theme.id === "obras-de-emergencia"
      ? "valor"
      : defaultMetric;

  return {
    defaultMetric: resolvedDefault,
    legendTitle: (metric) =>
      metric === "valor" ? labels.valor : labels.count,
    metricLabel: (metric) =>
      metric === "valor"
        ? `Coropleta · ${labels.valor}`
        : `Coropleta · ${labels.count}`,
    legendHint: (metric) =>
      metric === "valor"
        ? "Cuantiles de valor en pesos · más cálido = mayor $ en el territorio"
        : `Cuantiles de ${labels.unit} · más cálido = mayor cantidad en el territorio`,
    toggleValor: labels.valor.includes("COP") ? "Valor $" : labels.valor,
    toggleCount: labels.count,
    tooltipPrimary: (metric) =>
      metric === "valor" ? labels.valor : labels.count,
    heatmapTitle: (metric) =>
      metric === "valor"
        ? `Calor · ${labels.valor} por depto × mes`
        : `Calor · ${labels.count} por depto × mes`,
    heatmapHint: (metric) =>
      metric === "valor"
        ? `Color = ${labels.valor}. Clic en celda para filtrar.`
        : `Color = ${labels.count}. Clic en celda para filtrar.`,
  };
}

/** Resuelve la métrica Auto: preferencia del tema, con fallback a datos. */
export function resolveAutoMapMetric(
  theme: ThemeLike,
  dataSuggestsValor: boolean,
): MapMetric {
  const sem = getThemeMapSemantics(theme);
  if (COUNT_PRIMARY.has(theme.id)) return "count";
  if (MONEY_PRIMARY.has(theme.id)) return "valor";
  if (theme.id === "agua-y-saneamiento" || theme.id === "obras-de-emergencia") {
    return dataSuggestsValor ? "valor" : "count";
  }
  return dataSuggestsValor && sem.defaultMetric === "valor" ? "valor" : sem.defaultMetric;
}
