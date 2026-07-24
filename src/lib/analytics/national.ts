/**
 * Motor del Centro de Mando Nacional — cruces territoriales entre las 8 bases.
 */
import {
  buildDecisionBrief,
  DECISION_THRESHOLDS,
  SOURCE_THEME_IDS,
  type DecisionAlert,
  type DecisionBrief,
  type DecisionKpi,
} from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import { buildThemeHref } from "@/lib/analytics/recordFilters";
import { resolveDepartment, type AreaStat } from "@/lib/geo/spatial";
import type { RecordRow } from "@/lib/records/types";

export type ThemeBundle = Record<string, RecordRow[]>;

export type TerritoryCell = {
  departamento: string;
  pressure: number;
  declaratoriaAbierta: number;
  intervenciones: number;
  valorTotal: number;
  byTheme: Record<string, { count: number; valor: number }>;
  gapRespuesta: boolean;
};

/** Celda micro: municipio dentro de un departamento. */
export type MunicipalityCell = {
  departamento: string;
  municipio: string;
  pressure: number;
  declaratoriaAbierta: number;
  intervenciones: number;
  valorTotal: number;
  byTheme: Record<string, { count: number; valor: number }>;
  gapRespuesta: boolean;
};

export type NationalBrief = {
  generatedAt: string;
  criteriaVersion: string;
  totals: {
    records: number;
    themesWithData: number;
    departamentosConDato: number;
    municipiosConDato: number;
    valorAgregado: number;
  };
  kpis: DecisionKpi[];
  /** Alertas nacionales (capadas para briefing). */
  alerts: DecisionAlert[];
  /** Todas las alertas (macro+micro sin cortar). */
  alertsAll: DecisionAlert[];
  themeBriefs: { themeId: string; themeLabel: string; brief: DecisionBrief }[];
  territories: TerritoryCell[];
  municipalities: MunicipalityCell[];
  mapAreas: AreaStat[];
  priorityDepts: TerritoryCell[];
  priorityMunicipalities: MunicipalityCell[];
  priorityKeys: {
    themeId: string;
    key: string;
    label: string;
    extra?: string;
    valor: number;
    href: string;
  }[];
  briefing: {
    headline: string;
    bullets: string[];
    moneyAtRisk: number;
    openDeclaratorias: number;
    gapMunicipios: number;
  };
};

export const THEME_LABEL: Record<string, string> = {
  fic: "FIC",
  "agua-y-saneamiento": "Agua",
  carrotanques: "Carrotanques",
  "banco-de-maquinaria": "Banco maquinaria",
  "obras-de-emergencia": "Obras emergencia",
  "obras-por-impuestos": "Obras impuestos",
  puentes: "Puentes",
  "declaratoria-de-emergencia": "Declaratorias",
};

function str(r: RecordRow, ...keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function num(r: RecordRow, ...keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v === undefined || v === null || v === "") continue;
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

function isDeclaratoriaAbierta(r: RecordRow) {
  if (str(r, "retorno_normalidad")) return false;
  const estado = str(r, "estado").toLowerCase();
  if (/cerrad|finaliz|retorn/.test(estado)) return false;
  return true;
}

function deptOf(r: RecordRow) {
  return resolveDepartment(String(r.departamento || ""))?.name || "";
}

function scorePressure(cell: {
  declaratoriaAbierta: number;
  intervenciones: number;
  valorTotal: number;
  byTheme: Record<string, { count: number; valor: number }>;
}): { pressure: number; gapRespuesta: boolean } {
  let pressure = 0;
  let gapRespuesta = false;
  if (cell.declaratoriaAbierta > 0) pressure += 40;
  if (cell.declaratoriaAbierta > 0 && cell.intervenciones === 0) {
    gapRespuesta = true;
    pressure += 35;
  } else if (cell.declaratoriaAbierta > 0 && cell.intervenciones < 3) {
    gapRespuesta = true;
    pressure += 15;
  }
  if ((cell.byTheme.fic?.valor || 0) > 0) pressure += 5;
  if ((cell.byTheme["agua-y-saneamiento"]?.count || 0) > 20) pressure += 10;
  if ((cell.byTheme.carrotanques?.count || 0) > 10) pressure += 5;
  pressure += Math.min(20, Math.round(Math.log10(cell.valorTotal + 1) * 4));
  return { pressure: Math.min(100, pressure), gapRespuesta };
}

function isInterventionTheme(themeId: string) {
  return (
    themeId === "agua-y-saneamiento" ||
    themeId === "obras-de-emergencia" ||
    themeId === "carrotanques" ||
    themeId === "banco-de-maquinaria"
  );
}

export function buildNationalBrief(bundle: ThemeBundle): NationalBrief {
  const enriched: ThemeBundle = {};
  for (const id of SOURCE_THEME_IDS) {
    const rows = bundle[id] || [];
    enriched[id] = enrichRecordsForDecision(rows);
  }

  const themeBriefs = SOURCE_THEME_IDS.map((themeId) => ({
    themeId,
    themeLabel: THEME_LABEL[themeId] || themeId,
    brief: buildDecisionBrief(themeId, enriched[themeId] || []),
  }));

  const byDept = new Map<string, TerritoryCell>();
  const byMuni = new Map<string, MunicipalityCell>();

  const touchDept = (dept: string) => {
    let cell = byDept.get(dept);
    if (!cell) {
      cell = {
        departamento: dept,
        pressure: 0,
        declaratoriaAbierta: 0,
        intervenciones: 0,
        valorTotal: 0,
        byTheme: {},
        gapRespuesta: false,
      };
      byDept.set(dept, cell);
    }
    return cell;
  };

  const touchMuni = (dept: string, municipio: string) => {
    const key = `${dept}||${municipio}`;
    let cell = byMuni.get(key);
    if (!cell) {
      cell = {
        departamento: dept,
        municipio,
        pressure: 0,
        declaratoriaAbierta: 0,
        intervenciones: 0,
        valorTotal: 0,
        byTheme: {},
        gapRespuesta: false,
      };
      byMuni.set(key, cell);
    }
    return cell;
  };

  let totalRecords = 0;
  let valorAgregado = 0;

  for (const themeId of SOURCE_THEME_IDS) {
    const rows = enriched[themeId] || [];
    totalRecords += rows.length;
    for (const r of rows) {
      const dept = deptOf(r);
      if (!dept) continue;
      const muni = str(r, "municipio") || "Sin municipio";
      const cell = touchDept(dept);
      const mcell = touchMuni(dept, muni);
      const valor = Number(r.valor || 0);
      cell.valorTotal += valor;
      mcell.valorTotal += valor;
      valorAgregado += valor;

      const slot = cell.byTheme[themeId] || { count: 0, valor: 0 };
      slot.count += 1;
      slot.valor += valor;
      cell.byTheme[themeId] = slot;

      const mslot = mcell.byTheme[themeId] || { count: 0, valor: 0 };
      mslot.count += 1;
      mslot.valor += valor;
      mcell.byTheme[themeId] = mslot;

      if (themeId === "declaratoria-de-emergencia" && isDeclaratoriaAbierta(r)) {
        cell.declaratoriaAbierta += 1;
        mcell.declaratoriaAbierta += 1;
      }
      if (isInterventionTheme(themeId)) {
        cell.intervenciones += 1;
        mcell.intervenciones += 1;
      }
    }
  }

  for (const cell of byDept.values()) {
    const scored = scorePressure(cell);
    cell.pressure = scored.pressure;
    cell.gapRespuesta = scored.gapRespuesta;
  }
  for (const cell of byMuni.values()) {
    const scored = scorePressure(cell);
    cell.pressure = scored.pressure;
    cell.gapRespuesta = scored.gapRespuesta;
  }

  const territories = [...byDept.values()].sort(
    (a, b) => b.pressure - a.pressure || b.valorTotal - a.valorTotal,
  );
  const municipalities = [...byMuni.values()].sort(
    (a, b) => b.pressure - a.pressure || b.valorTotal - a.valorTotal,
  );
  const priorityDepts = territories.slice(0, 10);
  const priorityMunicipalities = municipalities.slice(0, 15);
  const gapDepts = territories.filter((t) => t.gapRespuesta);
  const gapMunis = municipalities.filter((t) => t.gapRespuesta);

  const alerts: DecisionAlert[] = [];
  if (gapDepts.length) {
    alerts.push({
      id: "nat-gap-declaratoria",
      severity: "critica",
      title: "Declaratoria sin respuesta operativa visible",
      detail: `${formatNumber(gapDepts.length)} departamentos y ${formatNumber(gapMunis.length)} municipios con declaratoria abierta y poca o nula intervención (agua/obras/flota) en las bases cargadas.`,
      action:
        "Pase a vista Micro, abra el territorio o la base afectada y priorice despliegue o verifique carga de datos.",
      count: gapDepts.length,
    });
  }

  let moneyAtRisk = 0;
  let openDeclaratorias = 0;
  const priorityKeys: NationalBrief["priorityKeys"] = [];

  for (const { themeId, brief } of themeBriefs) {
    for (const a of brief.alerts) {
      if (a.severity === "critica" || a.severity === "alta" || a.severity === "media") {
        alerts.push({
          ...a,
          id: `${themeId}:${a.id}`,
          title: `${THEME_LABEL[themeId] || themeId}: ${a.title}`,
        });
      }
      if (a.valor) moneyAtRisk += a.valor;
    }
    for (const p of brief.priorityList) {
      priorityKeys.push({
        themeId,
        key: p.key,
        label: `${THEME_LABEL[themeId]} · ${p.label}`,
        extra: p.extra,
        valor: p.valor,
        href: buildThemeHref(themeId, { q: p.key, tab: "analitica" }),
      });
    }
  }

  openDeclaratorias = (enriched["declaratoria-de-emergencia"] || []).filter(
    isDeclaratoriaAbierta,
  ).length;

  const alertsAll = alerts.sort((a, b) => {
    const rank = { critica: 0, alta: 1, media: 2, info: 3 };
    return rank[a.severity] - rank[b.severity];
  });
  const alertCap = alertsAll.slice(0, 12);

  const ficBrief = themeBriefs.find((t) => t.themeId === "fic")?.brief;
  const aguaBrief = themeBriefs.find(
    (t) => t.themeId === "agua-y-saneamiento",
  )?.brief;

  const kpis: DecisionKpi[] = [
    {
      id: "records",
      label: "Registros nacionales",
      value: formatNumber(totalRecords),
      hint: `${SOURCE_THEME_IDS.filter((id) => (enriched[id] || []).length).length} bases con dato`,
    },
    {
      id: "pressure",
      label: "Deptos en presión alta",
      value: formatNumber(territories.filter((t) => t.pressure >= 50).length),
      tone: territories.some((t) => t.pressure >= 50) ? "rojo" : "verde",
      hint: "Score ≥ 50 (declaratoria + brecha + carga)",
    },
    {
      id: "money",
      label: "Dinero en riesgo (alertas)",
      value: formatCop(moneyAtRisk),
      tone: moneyAtRisk > 0 ? "rojo" : "verde",
      hint: "Suma de valores en alertas críticas/altas por tema",
    },
    {
      id: "decl",
      label: "Declaratorias abiertas",
      value: formatNumber(openDeclaratorias),
      tone: openDeclaratorias > 0 ? "amarillo" : "verde",
    },
  ];

  const bullets = [
    gapDepts.length
      ? `${gapDepts.length} deptos / ${gapMunis.length} municipios con declaratoria y baja intervención: ${gapDepts
          .slice(0, 5)
          .map((d) => d.departamento)
          .join(", ")}`
      : "No se detectó brecha declaratoria–intervención a nivel departamento.",
    ficBrief?.alerts[0]
      ? `FIC: ${ficBrief.alerts[0].title}`
      : "FIC sin alertas críticas en la muestra cargada.",
    aguaBrief?.alerts[0]
      ? `Agua: ${aguaBrief.alerts[0].title}`
      : "Agua sin alertas críticas en la muestra cargada.",
    `Criterios v${DECISION_THRESHOLDS.version}: cola Agua ≥${DECISION_THRESHOLDS.aguaDiasCola}d · CT estancado >${DECISION_THRESHOLDS.carrotanqueDiasEstancado}d.`,
  ];

  const mapAreas: AreaStat[] = territories.map((t) => ({
    name: t.departamento,
    valor: t.pressure,
    count: Object.values(t.byTheme).reduce((s, x) => s + x.count, 0),
  }));

  return {
    generatedAt: new Date().toISOString(),
    criteriaVersion: DECISION_THRESHOLDS.version,
    totals: {
      records: totalRecords,
      themesWithData: SOURCE_THEME_IDS.filter((id) => (enriched[id] || []).length)
        .length,
      departamentosConDato: territories.length,
      municipiosConDato: municipalities.length,
      valorAgregado,
    },
    kpis,
    alerts: alertCap,
    alertsAll,
    themeBriefs,
    territories,
    municipalities,
    mapAreas,
    priorityDepts,
    priorityMunicipalities,
    priorityKeys: priorityKeys.sort((a, b) => b.valor - a.valor),
    briefing: {
      headline:
        "Briefing nacional UNGRD — presión territorial, dinero en riesgo y claves a desbloquear",
      bullets,
      moneyAtRisk,
      openDeclaratorias,
      gapMunicipios: gapMunis.length || gapDepts.length,
    },
  };
}
