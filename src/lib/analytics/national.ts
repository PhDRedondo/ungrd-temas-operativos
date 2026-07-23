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

export type NationalBrief = {
  generatedAt: string;
  criteriaVersion: string;
  totals: {
    records: number;
    themesWithData: number;
    departamentosConDato: number;
    valorAgregado: number;
  };
  kpis: DecisionKpi[];
  alerts: DecisionAlert[];
  themeBriefs: { themeId: string; brief: DecisionBrief }[];
  territories: TerritoryCell[];
  mapAreas: AreaStat[];
  priorityDepts: TerritoryCell[];
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

const THEME_LABEL: Record<string, string> = {
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

export function buildNationalBrief(bundle: ThemeBundle): NationalBrief {
  const enriched: ThemeBundle = {};
  for (const id of SOURCE_THEME_IDS) {
    const rows = bundle[id] || [];
    enriched[id] = enrichRecordsForDecision(rows);
  }

  const themeBriefs = SOURCE_THEME_IDS.map((themeId) => ({
    themeId,
    brief: buildDecisionBrief(themeId, enriched[themeId] || []),
  }));

  const byDept = new Map<string, TerritoryCell>();
  const touch = (dept: string) => {
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

  let totalRecords = 0;
  let valorAgregado = 0;

  for (const themeId of SOURCE_THEME_IDS) {
    const rows = enriched[themeId] || [];
    totalRecords += rows.length;
    for (const r of rows) {
      const dept = deptOf(r);
      if (!dept) continue;
      const cell = touch(dept);
      const valor = Number(r.valor || 0);
      cell.valorTotal += valor;
      valorAgregado += valor;
      const slot = cell.byTheme[themeId] || { count: 0, valor: 0 };
      slot.count += 1;
      slot.valor += valor;
      cell.byTheme[themeId] = slot;

      if (themeId === "declaratoria-de-emergencia" && isDeclaratoriaAbierta(r)) {
        cell.declaratoriaAbierta += 1;
      }
      if (
        themeId === "agua-y-saneamiento" ||
        themeId === "obras-de-emergencia" ||
        themeId === "carrotanques" ||
        themeId === "banco-de-maquinaria"
      ) {
        cell.intervenciones += 1;
      }
    }
  }

  for (const cell of byDept.values()) {
    let pressure = 0;
    if (cell.declaratoriaAbierta > 0) pressure += 40;
    if (cell.declaratoriaAbierta > 0 && cell.intervenciones === 0) {
      cell.gapRespuesta = true;
      pressure += 35;
    } else if (cell.declaratoriaAbierta > 0 && cell.intervenciones < 3) {
      cell.gapRespuesta = true;
      pressure += 15;
    }
    if ((cell.byTheme.fic?.valor || 0) > 0) pressure += 5;
    if ((cell.byTheme["agua-y-saneamiento"]?.count || 0) > 20) pressure += 10;
    if ((cell.byTheme.carrotanques?.count || 0) > 10) pressure += 5;
    pressure += Math.min(20, Math.round(Math.log10(cell.valorTotal + 1) * 4));
    cell.pressure = Math.min(100, pressure);
  }

  const territories = [...byDept.values()].sort(
    (a, b) => b.pressure - a.pressure || b.valorTotal - a.valorTotal,
  );
  const priorityDepts = territories.slice(0, 10);
  const gapDepts = territories.filter((t) => t.gapRespuesta);

  const alerts: DecisionAlert[] = [];
  if (gapDepts.length) {
    alerts.push({
      id: "nat-gap-declaratoria",
      severity: "critica",
      title: "Declaratoria sin respuesta operativa visible",
      detail: `${formatNumber(gapDepts.length)} departamentos con declaratoria abierta y poca o nula intervención (agua/obras/flota) en las bases cargadas.`,
      action:
        "Priorice despliegue o verifique carga de datos en esos territorios desde el ranking nacional.",
      count: gapDepts.length,
    });
  }

  let moneyAtRisk = 0;
  let openDeclaratorias = 0;
  const priorityKeys: NationalBrief["priorityKeys"] = [];

  for (const { themeId, brief } of themeBriefs) {
    for (const a of brief.alerts) {
      if (a.severity === "critica" || a.severity === "alta") {
        alerts.push({
          ...a,
          id: `${themeId}:${a.id}`,
          title: `${THEME_LABEL[themeId] || themeId}: ${a.title}`,
        });
      }
      if (a.valor) moneyAtRisk += a.valor;
    }
    for (const p of brief.priorityList.slice(0, 3)) {
      priorityKeys.push({
        themeId,
        key: p.key,
        label: `${THEME_LABEL[themeId]} · ${p.label}`,
        extra: p.extra,
        valor: p.valor,
        href: `/app/temas/${themeId}`,
      });
    }
  }

  openDeclaratorias = (enriched["declaratoria-de-emergencia"] || []).filter(
    isDeclaratoriaAbierta,
  ).length;

  // Deduplicate / cap alerts
  const alertCap = alerts
    .sort((a, b) => {
      const rank = { critica: 0, alta: 1, media: 2, info: 3 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 12);

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
      ? `${gapDepts.length} deptos con declaratoria y baja intervención: ${gapDepts
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
      valorAgregado,
    },
    kpis,
    alerts: alertCap,
    themeBriefs,
    territories,
    mapAreas,
    priorityDepts,
    priorityKeys: priorityKeys
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
    briefing: {
      headline:
        "Briefing nacional UNGRD — presión territorial, dinero en riesgo y claves a desbloquear",
      bullets,
      moneyAtRisk,
      openDeclaratorias,
      gapMunicipios: gapDepts.length,
    },
  };
}
