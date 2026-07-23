/**
 * Series de tiempo por tema: métrica y fecha alineadas a la realidad de cada base.
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

/** Campos de fecha preferidos por tema (orden de prioridad). */
const DATE_FIELDS_BY_THEME: Record<string, string[]> = {
  fic: [
    "fecha",
    "fecha_de_desembolso",
    "fecha_acto_administrativo_resolucion",
    "fecha_formato_de_aprobacion_de_la_atencion",
  ],
  "agua-y-saneamiento": [
    "fecha",
    "fecha_de_pago",
    "fecha_ultimo_seguimiento",
    "fecha_inicio_orden",
    "fecha_sucripcion",
    "fecha_de_asignacion",
  ],
  carrotanques: [
    "fecha",
    "fecha_desde_ultm_estado",
    "fecha_inicio_estado_actual",
    "fecha_corte_del_reporte",
    "fecha_fin",
  ],
  "banco-de-maquinaria": [
    "fecha",
    "fecha_entrega_o_recibo",
    "fecha_acta_de_inicio",
    "fecha_cdp",
  ],
  "obras-de-emergencia": [
    "fecha",
    "fecha_orden",
    "fecha_de_activacion",
    "acta_de_inicio_fecha_inicial",
    "fecha_aceptacion",
  ],
  "obras-por-impuestos": [
    "fecha",
    "fecha_de_inicio_del_convenio",
    "fecha_de_activacion",
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
  "agua-y-saneamiento": "Fecha de suscripción / pago / seguimiento",
  carrotanques: "Fecha de estado / corte del reporte",
  "banco-de-maquinaria": "Fecha de recibo / entrega / acta",
  "obras-de-emergencia": "Fecha de inicio / orden / activación",
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
  totalPoints: number;
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
  // DD/MM/YYYY o MM/DD/YYYY ambiguo: preferir ISO-like
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3]!;
    // Si a > 12 → día/mes; si b > 12 → mes/día; si ambos ≤12 asumir DD/MM (CO)
    if (a > 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  return "";
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
    seriesSubtitle: (metric: MapMetric) =>
      `Eje X: ${dateLabel} (mes). Eje Y: ${mapSem.legendTitle(metric)}. Clic en un mes para filtrar.`,
    yLabel: (metric: MapMetric) => mapSem.legendTitle(metric),
    mapSem,
  };
}

function monthKey(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}/.test(isoDate)) return null;
  return isoDate.slice(0, 7);
}

/** Rellena meses faltantes entre min y max para una línea continua. */
export function fillMonthGaps(points: TimePoint[]): TimePoint[] {
  if (points.length < 2) return points;
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const start = sorted[0]!.period;
  const end = sorted[sorted.length - 1]!.period;
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

export function buildThemeTimeSeries(
  rows: RecordRow[],
  theme: ThemeLike,
  metricOverride: MapMetric | "auto" = "auto",
  opts?: { fillGaps?: boolean },
): TimeSeriesResult {
  const labels = getThemeTimeLabels(theme);
  const map = new Map<string, { valor: number; count: number }>();
  let unmatchedDates = 0;

  for (const r of rows) {
    const d = resolveEventDate(r, theme.id);
    const key = monthKey(d);
    if (!key) {
      unmatchedDates += 1;
      continue;
    }
    const cur = map.get(key) || { valor: 0, count: 0 };
    cur.valor += Number(r.valor || 0);
    cur.count += 1;
    map.set(key, cur);
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

  if (opts?.fillGaps !== false) {
    points = fillMonthGaps(points);
  }

  return {
    points,
    metric,
    title: labels.seriesTitle(metric),
    subtitle: labels.seriesSubtitle(metric),
    yLabel: labels.yLabel(metric),
    dateLabel: labels.dateLabel,
    unmatchedDates,
    totalPoints: points.filter((p) => p.count > 0 || p.valor > 0).length,
  };
}

export type { ThemeMapSemantics };
