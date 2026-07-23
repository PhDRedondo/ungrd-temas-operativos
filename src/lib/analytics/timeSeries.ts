/**
 * Series de tiempo por tema: métrica y fecha alineadas a la realidad de cada base.
 * Evita el gráfico “plano + pico” por huecos de 7 años o fechas basura masivas.
 */
import {
  getThemeMapSemantics,
  resolveAutoMapMetric,
  type ThemeMapSemantics,
} from "@/lib/geo/themeMapSemantics";
import type { MapMetric } from "@/lib/geo/spatial";
import type { RecordRow } from "@/lib/records/types";

type ThemeLike = {
  id: string;
  name: string;
  unit: string;
  valueLabel: string;
};

export type SeriesWindow = "12" | "24" | "36" | "all";

/** Campos de fecha preferidos por tema (orden de prioridad). */
const DATE_FIELDS_BY_THEME: Record<string, string[]> = {
  fic: [
    "fecha",
    "fecha_de_desembolso",
    "fecha_acto_administrativo_resolucion",
    "fecha_formato_de_aprobacion_de_la_atencion",
  ],
  "agua-y-saneamiento": [
    "fecha_de_pago",
    "fecha_ultimo_seguimiento",
    "fecha_inicio_orden",
    "fecha",
    "fecha_sucripcion",
    "fecha_de_asignacion",
  ],
  carrotanques: [
    "fecha_desde_ultm_estado",
    "fecha_inicio_estado_actual",
    "fecha_corte_del_reporte",
    "fecha",
    "fecha_fin",
  ],
  "banco-de-maquinaria": [
    "fecha_entrega_o_recibo",
    "fecha_acta_de_inicio",
    "fecha",
    "fecha_cdp",
  ],
  "obras-de-emergencia": [
    "fecha_orden",
    "fecha_de_activacion",
    "acta_de_inicio_fecha_inicial",
    "fecha",
    "fecha_aceptacion",
  ],
  "obras-por-impuestos": [
    "fecha_de_inicio_del_convenio",
    "fecha_de_activacion",
    "fecha",
    "fecha_finalizacion",
  ],
  puentes: [
    "fecha",
    "fecha_de_instalacion",
    "fecha_de_inicio_proceso",
    "fecha_de_termino_de_proceso",
  ],
  "declaratoria-de-emergencia": [
    "fecha",
    "fecha_inicio_prorroga",
    "fecha_de_inicio_modificacion",
    "fecha_inicio_retorno",
  ],
};

const DEFAULT_DATE_FIELDS = [
  "fecha",
  "fecha_de_pago",
  "fecha_de_desembolso",
  "fecha_inicio",
  "fecha_de_inicio",
  "fecha_corte_del_reporte",
];

const DATE_LABEL: Record<string, string> = {
  fic: "Fecha de desembolso / acto",
  "agua-y-saneamiento": "Fecha de pago / seguimiento / inicio orden",
  carrotanques: "Fecha de estado / corte del reporte",
  "banco-de-maquinaria": "Fecha de recibo / entrega / acta",
  "obras-de-emergencia": "Fecha de orden / activación / inicio",
  "obras-por-impuestos": "Fecha de inicio / activación del convenio",
  puentes: "Fecha de instalación / proceso",
  "declaratoria-de-emergencia": "Fecha de inicio de la declaratoria",
};

export type TimePoint = {
  period: string;
  value: number;
  count: number;
  valor: number;
};

export type TimeSeriesResult = {
  points: TimePoint[];
  metric: MapMetric;
  title: string;
  subtitle: string;
  yLabel: string;
  dateLabel: string;
  unmatchedDates: number;
  excludedFuture: number;
  excludedBulk: number;
  totalPoints: number;
  window: SeriesWindow;
  /** Meses con dato real antes de recortar ventana */
  monthsWithData: number;
};

function normalizeDate(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(raw));
    return epoch.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3]!;
    if (a > 12)
      return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12)
      return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    // CO: DD/MM/YYYY
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  return "";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(period: string, delta: number): string {
  const [y0, m0] = period.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y0, m0 - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
}

/** Mejor fecha de evento para la serie del tema. */
export function resolveEventDate(row: RecordRow, themeId: string): string {
  const fields = DATE_FIELDS_BY_THEME[themeId] || DEFAULT_DATE_FIELDS;
  for (const f of fields) {
    const d = normalizeDate(row[f]);
    if (d) return d;
  }
  return normalizeDate(row.fecha);
}

export function getThemeTimeLabels(theme: ThemeLike) {
  const mapSem = getThemeMapSemantics(theme);
  const dateLabel = DATE_LABEL[theme.id] || "Fecha del registro";
  return {
    dateLabel,
    seriesTitle: (metric: MapMetric) =>
      metric === "valor"
        ? `Serie temporal · ${mapSem.legendTitle("valor")}`
        : `Serie temporal · ${mapSem.legendTitle("count")}`,
    seriesSubtitle: (metric: MapMetric, window: SeriesWindow) => {
      const win =
        window === "all"
          ? "todo el histórico con dato"
          : `últimos ${window} meses con actividad`;
      return `Eje X: ${dateLabel} (${win}). Eje Y: ${mapSem.legendTitle(metric)}. Clic en un mes para filtrar.`;
    },
    yLabel: (metric: MapMetric) => mapSem.legendTitle(metric),
    mapSem,
  };
}

function monthKey(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}/.test(isoDate)) return null;
  return isoDate.slice(0, 7);
}

/** Rellena huecos solo si el tramo es corto (≤ 24 meses). */
export function fillMonthGaps(
  points: TimePoint[],
  maxSpanMonths = 24,
): TimePoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const start = sorted[0]!.period;
  const end = sorted[sorted.length - 1]!.period;
  if (monthsBetween(start, end) > maxSpanMonths) return sorted;
  const by = new Map(sorted.map((p) => [p.period, p]));
  const out: TimePoint[] = [];
  let [y, m] = start.split("-").map(Number) as [number, number];
  const [ey, em] = end.split("-").map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(by.get(key) || { period: key, value: 0, count: 0, valor: 0 });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Detecta mes “basura” (carga masiva con la misma fecha): ≥40% del total y ≥80 filas.
 * Esos meses se excluyen de la serie por defecto para no aplastar la escala.
 */
export function detectBulkDumpMonths(
  map: Map<string, { count: number; valor: number }>,
): Set<string> {
  const total = [...map.values()].reduce((s, v) => s + v.count, 0);
  const out = new Set<string>();
  if (total < 80) return out;
  for (const [period, v] of map) {
    if (v.count >= 80 && v.count / total >= 0.4) out.add(period);
  }
  return out;
}

function applyWindow(
  points: TimePoint[],
  window: SeriesWindow,
): TimePoint[] {
  if (window === "all" || points.length === 0) return points;
  const n = Number(window);
  const withData = points.filter((p) => p.count > 0 || p.valor > 0);
  if (withData.length <= n) return withData;
  const last = withData[withData.length - 1]!.period;
  const start = addMonths(last, -(n - 1));
  return withData.filter((p) => p.period >= start);
}

export function buildThemeTimeSeries(
  rows: RecordRow[],
  theme: ThemeLike,
  metricOverride: MapMetric | "auto" = "auto",
  opts?: {
    fillGaps?: boolean;
    window?: SeriesWindow;
    /** Si true, no excluye meses de carga masiva */
    keepBulkMonths?: boolean;
  },
): TimeSeriesResult {
  const labels = getThemeTimeLabels(theme);
  const window: SeriesWindow = opts?.window || "24";
  const map = new Map<string, { valor: number; count: number }>();
  let unmatchedDates = 0;
  let excludedFuture = 0;
  const maxFuture = addMonths(todayIso().slice(0, 7), 2);

  for (const r of rows) {
    const d = resolveEventDate(r, theme.id);
    const key = monthKey(d);
    if (!key) {
      unmatchedDates += 1;
      continue;
    }
    // Fechas muy a futuro suelen ser defaults/errores de carga
    if (key > maxFuture) {
      excludedFuture += 1;
      continue;
    }
    // Fechas absurdas pre-2000
    if (key < "2000-01") {
      unmatchedDates += 1;
      continue;
    }
    const cur = map.get(key) || { valor: 0, count: 0 };
    cur.valor += Number(r.valor || 0);
    cur.count += 1;
    map.set(key, cur);
  }

  const bulkMonths = opts?.keepBulkMonths
    ? new Set<string>()
    : detectBulkDumpMonths(map);
  let excludedBulk = 0;
  if (bulkMonths.size) {
    for (const p of bulkMonths) {
      excludedBulk += map.get(p)?.count || 0;
      map.delete(p);
    }
  }

  const anyValor = [...map.values()].some((v) => v.valor > 0);
  const metric: MapMetric =
    metricOverride === "auto"
      ? resolveAutoMapMetric(theme, anyValor)
      : metricOverride;

  let points: TimePoint[] = [...map.entries()]
    .map(([period, v]) => ({
      period,
      count: v.count,
      valor: v.valor,
      value: metric === "valor" ? v.valor : v.count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const monthsWithData = points.length;
  points = applyWindow(points, window);

  // Solo rellenar huecos dentro de ventanas cortas (evita 2019→2026 en cero)
  if (opts?.fillGaps !== false && window !== "all") {
    points = fillMonthGaps(points, Number(window) || 24);
  } else if (opts?.fillGaps !== false && window === "all") {
    points = fillMonthGaps(points, 18);
  }

  const notes: string[] = [];
  if (excludedBulk > 0) {
    notes.push(
      `${excludedBulk} filas en mes(es) de carga masiva omitidas para no aplastar la escala`,
    );
  }
  if (excludedFuture > 0) {
    notes.push(`${excludedFuture} con fecha a futuro omitidas`);
  }

  const baseSubtitle = labels.seriesSubtitle(metric, window);
  const subtitle = notes.length
    ? `${baseSubtitle} · ${notes.join(" · ")}`
    : baseSubtitle;

  return {
    points,
    metric,
    title: labels.seriesTitle(metric),
    subtitle,
    yLabel: labels.yLabel(metric),
    dateLabel: labels.dateLabel,
    unmatchedDates,
    excludedFuture,
    excludedBulk,
    totalPoints: points.filter((p) => p.count > 0 || p.valor > 0).length,
    window,
    monthsWithData,
  };
}

export type { ThemeMapSemantics };
