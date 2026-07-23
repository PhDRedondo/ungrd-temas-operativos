/**
 * Motor de analítica para toma de decisión — solo campos reales de las bases.
 * Temas source (schemaVersion 3): FIC, Agua, Carrotanques, Banco, Obras, Puentes, Declaratoria.
 */
import type { RecordRow } from "@/lib/records/types";

export type SemaphoreLevel = "verde" | "amarillo" | "rojo" | "gris";

export type SemaphoreBucket = {
  level: SemaphoreLevel;
  label: string;
  count: number;
  valor: number;
};

export type DecisionAlert = {
  id: string;
  severity: "critica" | "alta" | "media" | "info";
  title: string;
  detail: string;
  count?: number;
  valor?: number;
};

export type DecisionKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: SemaphoreLevel;
};

export type RankedItem = {
  key: string;
  label: string;
  count: number;
  valor: number;
  extra?: string;
};

export type DecisionBrief = {
  themeId: string;
  title: string;
  subtitle: string;
  kpis: DecisionKpi[];
  semaphores: SemaphoreBucket[];
  alerts: DecisionAlert[];
  byLayer: RankedItem[];
  priorityList: RankedItem[];
  focusLabel: string;
};

const SOURCE_THEMES = new Set([
  "fic",
  "agua-y-saneamiento",
  "carrotanques",
  "banco-de-maquinaria",
  "obras-de-emergencia",
  "obras-por-impuestos",
  "puentes",
  "declaratoria-de-emergencia",
]);

export function isSourceTheme(themeId: string) {
  return SOURCE_THEMES.has(themeId);
}

function num(r: RecordRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    let t = String(v).trim().replace(/[$\s]/g, "");
    // Formato CO: 1.234.567,89
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+,\d+$/.test(t)) {
      t = t.replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
    const n = Number(t.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function str(r: RecordRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function hasText(r: RecordRow, ...keys: string[]) {
  return str(r, ...keys) !== "";
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysFromToday(raw: string): number | null {
  const d = parseDate(raw);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
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

function classifyLegalizacion(estado: string): SemaphoreLevel {
  const e = estado.toUpperCase();
  if (!e) return "gris";
  if (/LEGALIZADO\s*100|LEGALIZADO\b/.test(e) && !/POR|PEND|VENCID|EJECUC/.test(e))
    return "verde";
  if (/VENCID|VENCIDO/.test(e)) return "rojo";
  if (/EJECUC|PEND|POR LEGALIZ|EN PROCESO|PRORROG/.test(e)) return "amarillo";
  if (/LEGALIZ/.test(e)) return "verde";
  return "amarillo";
}

function classifyEstadoGenerico(estado: string): SemaphoreLevel {
  const e = estado.toLowerCase();
  if (!e) return "gris";
  if (/finaliz|entregad|operativ|funcional|activo|cumpl|cerrad|legaliz/.test(e))
    return "verde";
  if (/suspend|vencid|crit|alerta|inactiv|aband|mora|riesgo/.test(e))
    return "rojo";
  if (/ejecuc|proceso|tramit|gesti|program|pend|prorro|construc/.test(e))
    return "amarillo";
  return "gris";
}

function bump(
  map: Map<string, SemaphoreBucket>,
  level: SemaphoreLevel,
  label: string,
  valor: number,
) {
  const cur = map.get(level) || { level, label, count: 0, valor: 0 };
  cur.count += 1;
  cur.valor += valor;
  map.set(level, cur);
}

function topN(
  entries: Map<string, { count: number; valor: number; extra?: string }>,
  n: number,
): RankedItem[] {
  return [...entries.entries()]
    .map(([key, v]) => ({
      key,
      label: key,
      count: v.count,
      valor: v.valor,
      extra: v.extra,
    }))
    .sort((a, b) => b.valor - a.valor || b.count - a.count)
    .slice(0, n);
}

function layerBreakdown(rows: RecordRow[]): RankedItem[] {
  const m = new Map<string, { count: number; valor: number }>();
  for (const r of rows) {
    const key =
      str(r, "tipo_registro", "capa") || "Sin clasificar";
    const cur = m.get(key) || { count: 0, valor: 0 };
    cur.count += 1;
    cur.valor += num(r, "valor");
    m.set(key, cur);
  }
  return topN(m, 12);
}

function buildFic(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let desembolso = 0;
  let porLegalizar = 0;
  let legalizado = 0;
  let vencidos = 0;
  let vencidosValor = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const valor = num(r, "valor");
    const pendiente = num(r, "valor_por_legalizar");
    const hecho = num(r, "valor_legalizado");
    desembolso += valor;
    porLegalizar += pendiente;
    legalizado += hecho;
    const estado = str(r, "estado");
    const level = classifyLegalizacion(estado);
    bump(sem, level, labelForLevel(level, "fic"), valor);

    const plazo = str(r, "fecha_inicial_para_legalizacion");
    const days = daysFromToday(plazo);
    const critico =
      pendiente > 0 &&
      ((days !== null && days > 0) || /VENCID/i.test(estado));
    if (critico) {
      vencidos += 1;
      vencidosValor += pendiente || valor;
      const key = str(r, "clave_seguimiento", "no_cdp") || "Sin CDP";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += pendiente || valor;
      cur.extra = estado || "Pendiente legalización";
      priority.set(key, cur);
    }
  }

  if (vencidos > 0) {
    alerts.push({
      id: "fic-vencidos",
      severity: "critica",
      title: "Transferencias con riesgo de legalización",
      detail: `${formatNumber(vencidos)} registros con saldo por legalizar y plazo vencido o estado VENCIDO.`,
      count: vencidos,
      valor: vencidosValor,
    });
  }
  if (porLegalizar > 0) {
    alerts.push({
      id: "fic-gap",
      severity: porLegalizar > desembolso * 0.15 ? "alta" : "media",
      title: "Saldo por legalizar",
      detail: `Hay ${formatCop(porLegalizar)} pendientes de legalizar frente a ${formatCop(desembolso)} desembolsados.`,
      valor: porLegalizar,
    });
  }

  const gapPct = desembolso > 0 ? (porLegalizar / desembolso) * 100 : 0;

  return {
    themeId: "fic",
    title: "Tablero de decisión — FIC",
    subtitle:
      "Legalización de transferencias directas (FR-1703-SMD-44) · clave No. CDP",
    kpis: [
      {
        id: "desembolso",
        label: "Desembolsado",
        value: formatCop(desembolso),
        hint: `${formatNumber(rows.length)} transferencias`,
      },
      {
        id: "por-legalizar",
        label: "Por legalizar",
        value: formatCop(porLegalizar),
        tone: porLegalizar > 0 ? "rojo" : "verde",
        hint: gapPct ? `${gapPct.toFixed(1)}% del desembolso` : undefined,
      },
      {
        id: "legalizado",
        label: "Legalizado (campo)",
        value: formatCop(legalizado),
        tone: "verde",
      },
      {
        id: "riesgo",
        label: "En riesgo / vencidos",
        value: formatNumber(vencidos),
        tone: vencidos > 0 ? "rojo" : "verde",
        hint: vencidosValor ? formatCop(vencidosValor) : undefined,
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "CDP prioritarios (saldo + plazo)",
  };
}

function labelForLevel(level: SemaphoreLevel, theme: string): string {
  if (theme === "fic") {
    if (level === "verde") return "Legalizado / al día";
    if (level === "amarillo") return "En ejecución / pendiente";
    if (level === "rojo") return "Vencido / crítico";
    return "Sin estado";
  }
  if (level === "verde") return "Estable / al día";
  if (level === "amarillo") return "En seguimiento";
  if (level === "rojo") return "Crítico / alerta";
  return "Sin clasificar";
}

function orderSemaphores(map: Map<string, SemaphoreBucket>): SemaphoreBucket[] {
  const order: SemaphoreLevel[] = ["rojo", "amarillo", "verde", "gris"];
  return order
    .map((l) => map.get(l))
    .filter((x): x is SemaphoreBucket => Boolean(x && x.count > 0));
}

function buildAgua(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let valorOp = 0;
  let valorPagado = 0;
  let colaDias = 0;
  let colaCount = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();
  let sinPago = 0;

  for (const r of rows) {
    const valor = num(r, "valor");
    valorOp += valor;
    valorPagado += num(
      r,
      "valor_pagado",
      "valor_pagado_total_con_impuestos",
      "valor_pagado_total",
    );
    const estado = str(r, "estado", "estado_actual");
    bump(sem, classifyEstadoGenerico(estado), labelForLevel(classifyEstadoGenerico(estado), "agua"), valor);

    const dias = num(r, "dias_desde_ult_gestion", "dias_en_gestion_de_pagos", "dias_totales_en_la_linea");
    if (dias >= 30) {
      colaCount += 1;
      colaDias += dias;
      const key = str(r, "clave_seguimiento", "orden_de_proveeduria") || "Sin OP";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += valor;
      cur.extra = `${Math.round(dias)} días sin gestión`;
      priority.set(key, cur);
    }

    const tipo = str(r, "tipo_registro", "capa");
    if (/pago/i.test(tipo) && !hasText(r, "op_paga") && !num(r, "valor_pagado")) {
      sinPago += 1;
    }
  }

  if (colaCount > 0) {
    alerts.push({
      id: "agua-cola",
      severity: "alta",
      title: "Órdenes con demora operativa",
      detail: `${formatNumber(colaCount)} registros con ≥30 días desde última gestión o en cola de pagos.`,
      count: colaCount,
    });
  }
  if (sinPago > 0) {
    alerts.push({
      id: "agua-pago",
      severity: "media",
      title: "Capas de pago incompletas",
      detail: `${formatNumber(sinPago)} filas de pago sin marca OP paga / valor pagado.`,
      count: sinPago,
    });
  }

  const execGap = Math.max(0, valorOp - valorPagado);

  return {
    themeId: "agua-y-saneamiento",
    title: "Tablero de decisión — Agua y saneamiento",
    subtitle: "Órdenes de proveeduría · control físico · bitácora · pagos",
    kpis: [
      {
        id: "op",
        label: "Valor órdenes (OP)",
        value: formatCop(valorOp),
        hint: `${formatNumber(rows.length)} registros`,
      },
      {
        id: "pagado",
        label: "Valor pagado (campos pago)",
        value: formatCop(valorPagado),
        tone: "verde",
      },
      {
        id: "gap",
        label: "Brecha OP − pagado",
        value: formatCop(execGap),
        tone: execGap > 0 ? "amarillo" : "verde",
      },
      {
        id: "cola",
        label: "En cola (≥30 días)",
        value: formatNumber(colaCount),
        tone: colaCount > 0 ? "rojo" : "verde",
        hint: colaCount ? `prom. ${Math.round(colaDias / colaCount)} días` : undefined,
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "OP prioritarias por demora",
  };
}

function buildCarrotanques(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let litros = 0;
  let viajes = 0;
  let estancados = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const valor = num(r, "valor");
    const estado = str(r, "estado");
    const level = classifyEstadoGenerico(estado);
    bump(sem, level, labelForLevel(level, "ct"), valor);
    litros += num(r, "litros_suministrados", "lt_suministrados");
    viajes += num(r, "cantidad_de_viajes");

    const days = daysFromToday(
      str(r, "fecha_desde_ultm_estado", "fecha_inicio_estado_actual", "fecha"),
    );
    if (days !== null && days > 45 && !/finaliz|entreg|operativ/i.test(estado)) {
      estancados += 1;
      const key = str(r, "clave_seguimiento", "placa", "placa_ungrd") || "Sin placa";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += valor;
      cur.extra = `${estado || "Sin estado"} · ${days} días`;
      priority.set(key, cur);
    }
  }

  if (estancados > 0) {
    alerts.push({
      id: "ct-estancados",
      severity: "alta",
      title: "Unidades estancadas en estado",
      detail: `${formatNumber(estancados)} registros con más de 45 días sin cambio de estado operativo.`,
      count: estancados,
    });
  }

  return {
    themeId: "carrotanques",
    title: "Tablero de decisión — Carrotanques",
    subtitle: "Flota · bitácora de estados · suministro (litros/viajes)",
    kpis: [
      {
        id: "flota",
        label: "Registros flota/bitácora",
        value: formatNumber(rows.length),
      },
      {
        id: "litros",
        label: "Litros suministrados",
        value: formatNumber(litros),
        tone: "verde",
      },
      {
        id: "viajes",
        label: "Viajes reportados",
        value: formatNumber(viajes),
      },
      {
        id: "estancados",
        label: "Estancados (>45 días)",
        value: formatNumber(estancados),
        tone: estancados > 0 ? "rojo" : "verde",
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Placas prioritarias",
  };
}

function buildBanco(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let alertaPoliza = 0;
  let alertaSoat = 0;
  let entregada = 0;
  let expectativa = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const valor = num(r, "valor", "valor_sin_iva", "valor_unitario");
    const estado = str(r, "estado");
    bump(sem, classifyEstadoGenerico(estado), labelForLevel(classifyEstadoGenerico(estado), "banco"), valor);
    entregada += num(r, "cantidad_maquinaria_entregada");
    expectativa += num(r, "cantidad_maquinaria_espectativa");

    const pol = hasText(r, "alerta_poliza_tr");
    const soat = hasText(r, "alerta_soat");
    if (pol) alertaPoliza += 1;
    if (soat) alertaSoat += 1;
    if (pol || soat) {
      const key = str(r, "clave_seguimiento", "serial", "no_convenio") || "Sin serial";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += valor;
      cur.extra = [pol ? "Póliza" : "", soat ? "SOAT" : ""].filter(Boolean).join(" · ");
      priority.set(key, cur);
    }
  }

  if (alertaPoliza + alertaSoat > 0) {
    alerts.push({
      id: "banco-alertas",
      severity: "critica",
      title: "Alertas de póliza / SOAT",
      detail: `${formatNumber(alertaPoliza)} con alerta póliza y ${formatNumber(alertaSoat)} con alerta SOAT.`,
      count: alertaPoliza + alertaSoat,
    });
  }
  if (expectativa > entregada) {
    alerts.push({
      id: "banco-entrega",
      severity: "media",
      title: "Brecha de entrega vs expectativa",
      detail: `Expectativa ${formatNumber(expectativa)} · entregada ${formatNumber(entregada)}.`,
    });
  }

  return {
    themeId: "banco-de-maquinaria",
    title: "Tablero de decisión — Banco de maquinaria",
    subtitle: "Inventario · convenios · bitácora · entregas a beneficiarios",
    kpis: [
      {
        id: "regs",
        label: "Registros",
        value: formatNumber(rows.length),
      },
      {
        id: "entregada",
        label: "Maquinaria entregada",
        value: formatNumber(entregada),
        tone: "verde",
      },
      {
        id: "expectativa",
        label: "Expectativa",
        value: formatNumber(expectativa),
      },
      {
        id: "alertas",
        label: "Alertas póliza/SOAT",
        value: formatNumber(alertaPoliza + alertaSoat),
        tone: alertaPoliza + alertaSoat > 0 ? "rojo" : "verde",
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Activos con alerta",
  };
}

function buildObrasEmergencia(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let anticipo = 0;
  let valor = 0;
  let pagoRiesgo = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const v = num(r, "valor");
    valor += v;
    anticipo += num(r, "valor_anticipo");
    const estado = str(r, "estado");
    const pago = str(r, "estado_de_pago");
    const levelObra = classifyEstadoGenerico(estado);
    const levelPago = classifyEstadoGenerico(pago);
    const level =
      levelObra === "rojo" || levelPago === "rojo"
        ? "rojo"
        : levelObra === "amarillo" || levelPago === "amarillo"
          ? "amarillo"
          : levelObra === "verde" && (levelPago === "verde" || !pago)
            ? "verde"
            : "gris";
    bump(sem, level, labelForLevel(level, "obras"), v);

    if (/pend|mora|atras|sin pago/i.test(pago) || levelPago === "rojo") {
      pagoRiesgo += 1;
      const key =
        str(r, "clave_seguimiento", "orden_de_proveeduria", "contrato_de_obra") ||
        "Sin contrato/OP";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += v;
      cur.extra = `Obra: ${estado || "—"} · Pago: ${pago || "—"}`;
      priority.set(key, cur);
    }
  }

  if (pagoRiesgo > 0) {
    alerts.push({
      id: "obras-pago",
      severity: "alta",
      title: "Obras con riesgo en estado de pago",
      detail: `${formatNumber(pagoRiesgo)} registros con estado de pago crítico o pendiente.`,
      count: pagoRiesgo,
    });
  }

  return {
    themeId: "obras-de-emergencia",
    title: "Tablero de decisión — Obras de emergencia",
    subtitle: "Contratos y órdenes de proveeduría · doble lectura obra/pago",
    kpis: [
      { id: "valor", label: "Valor contractual/OP", value: formatCop(valor) },
      {
        id: "anticipo",
        label: "Anticipos",
        value: formatCop(anticipo),
        hint: valor ? `${((anticipo / valor) * 100).toFixed(1)}% del valor` : undefined,
      },
      {
        id: "riesgo-pago",
        label: "Riesgo de pago",
        value: formatNumber(pagoRiesgo),
        tone: pagoRiesgo > 0 ? "rojo" : "verde",
      },
      {
        id: "regs",
        label: "Registros",
        value: formatNumber(rows.length),
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Contratos/OP prioritarios",
  };
}

function buildObrasImpuestos(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let valor = 0;
  let valorInt = 0;
  let vencidos = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const v = num(r, "valor");
    valor += v;
    valorInt += num(r, "valor_convenio_de_interventoria");
    const estado = str(r, "estado");
    bump(sem, classifyEstadoGenerico(estado), labelForLevel(classifyEstadoGenerico(estado), "imp"), v);
    const fin = str(
      r,
      "fecha_de_terminacion_del_convenio",
      "fecha_finalizacion",
      "fecha_de_finalizacion",
    );
    const days = daysFromToday(fin);
    if (days !== null && days > 0 && !/finaliz|cerrad|terminad/i.test(estado)) {
      vencidos += 1;
      const key = str(r, "clave_seguimiento", "no_convenio") || "Sin convenio";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += v;
      cur.extra = `Vencido hace ${days} días · ${estado || "sin estado"}`;
      priority.set(key, cur);
    }
  }

  if (vencidos > 0) {
    alerts.push({
      id: "imp-vencidos",
      severity: "alta",
      title: "Convenios con fecha de terminación vencida",
      detail: `${formatNumber(vencidos)} convenios activos/abiertos ya superaron la fecha de fin.`,
      count: vencidos,
    });
  }

  return {
    themeId: "obras-por-impuestos",
    title: "Tablero de decisión — Obras por impuestos",
    subtitle: "Convenios e interventoría · plazos y estados",
    kpis: [
      { id: "valor", label: "Valor convenios", value: formatCop(valor) },
      {
        id: "interventoria",
        label: "Valor interventoría",
        value: formatCop(valorInt),
      },
      {
        id: "vencidos",
        label: "Plazo vencido",
        value: formatNumber(vencidos),
        tone: vencidos > 0 ? "rojo" : "verde",
      },
      { id: "regs", label: "Registros", value: formatNumber(rows.length) },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Convenios vencidos",
  };
}

function buildPuentes(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let avanceSum = 0;
  let avanceN = 0;
  let noFuncional = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const v = num(r, "valor");
    const estado = str(r, "estado", "estado_actual_detallado");
    const level = classifyEstadoGenerico(estado);
    bump(sem, level, labelForLevel(level, "puentes"), v);
    const avance = num(r, "porcentaje_de_avance");
    if (avance > 0) {
      avanceSum += avance;
      avanceN += 1;
    }
    const func = str(r, "funcionalidad");
    if (func && /no|inhab|parcial|crit/i.test(func)) {
      noFuncional += 1;
      const key = str(r, "clave_seguimiento", "id") || "Sin ID";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += v;
      cur.extra = `${func} · ${estado || "—"}`;
      priority.set(key, cur);
    }
  }

  if (noFuncional > 0) {
    alerts.push({
      id: "puentes-func",
      severity: "alta",
      title: "Puentes con funcionalidad en riesgo",
      detail: `${formatNumber(noFuncional)} registros con funcionalidad no plena o crítica.`,
      count: noFuncional,
    });
  }

  const avgAvance = avanceN ? avanceSum / avanceN : 0;

  return {
    themeId: "puentes",
    title: "Tablero de decisión — Puentes",
    subtitle: "Inventario SMD · avance y funcionalidad",
    kpis: [
      { id: "regs", label: "Puentes / registros", value: formatNumber(rows.length) },
      {
        id: "avance",
        label: "Avance promedio",
        value: `${avgAvance.toFixed(1)}%`,
        tone: avgAvance >= 80 ? "verde" : avgAvance >= 40 ? "amarillo" : "rojo",
      },
      {
        id: "nofunc",
        label: "Funcionalidad en riesgo",
        value: formatNumber(noFuncional),
        tone: noFuncional > 0 ? "rojo" : "verde",
      },
      {
        id: "valor",
        label: "Valor asociado",
        value: formatCop(rows.reduce((a, r) => a + num(r, "valor"), 0)),
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Puentes prioritarios",
  };
}

function buildDeclaratoria(rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  const alerts: DecisionAlert[] = [];
  let activas = 0;
  let prorrogadas = 0;
  let retorno = 0;
  const priority = new Map<string, { count: number; valor: number; extra?: string }>();

  for (const r of rows) {
    const v = num(r, "valor");
    const estado = str(r, "estado");
    bump(sem, classifyEstadoGenerico(estado), labelForLevel(classifyEstadoGenerico(estado), "dec"), v);
    if (hasText(r, "prorroga")) prorrogadas += 1;
    if (hasText(r, "retorno_normalidad")) retorno += 1;

    const fin = str(
      r,
      "fecha_de_terminacion",
      "fecha_de_terminacion_modificacion",
      "fecha_de_terminacion_prorroga",
    );
    const days = daysFromToday(fin);
    const abierta = !hasText(r, "retorno_normalidad");
    if (abierta && days !== null && days > 0) {
      activas += 1;
      const key = str(r, "clave_seguimiento", "no_declaratoria") || "Sin Nº";
      const cur = priority.get(key) || { count: 0, valor: 0 };
      cur.count += 1;
      cur.valor += v;
      cur.extra = `Terminación hace ${days} días · ${str(r, "evento") || "evento"}`;
      priority.set(key, cur);
    } else if (abierta) {
      activas += 1;
    }
  }

  if (priority.size > 0) {
    alerts.push({
      id: "dec-vencidas",
      severity: "alta",
      title: "Declaratorias abiertas con término vencido",
      detail: `${formatNumber(priority.size)} sin retorno a normalidad y fecha de terminación superada.`,
      count: priority.size,
    });
  }

  return {
    themeId: "declaratoria-de-emergencia",
    title: "Tablero de decisión — Declaratorias",
    subtitle: "Decretos de calamidad · prórrogas · retorno a normalidad",
    kpis: [
      { id: "regs", label: "Declaratorias", value: formatNumber(rows.length) },
      {
        id: "activas",
        label: "Sin retorno a normalidad",
        value: formatNumber(activas),
        tone: activas > 0 ? "amarillo" : "verde",
      },
      {
        id: "prorroga",
        label: "Con prórroga",
        value: formatNumber(prorrogadas),
      },
      {
        id: "retorno",
        label: "Con retorno",
        value: formatNumber(retorno),
        tone: "verde",
      },
    ],
    semaphores: orderSemaphores(sem),
    alerts,
    byLayer: layerBreakdown(rows),
    priorityList: topN(priority, 15),
    focusLabel: "Declaratorias a cerrar",
  };
}

function buildGeneric(themeId: string, rows: RecordRow[]): DecisionBrief {
  const sem = new Map<string, SemaphoreBucket>();
  let valor = 0;
  for (const r of rows) {
    const v = num(r, "valor");
    valor += v;
    const level = classifyEstadoGenerico(str(r, "estado"));
    bump(sem, level, labelForLevel(level, "gen"), v);
  }
  return {
    themeId,
    title: "Tablero operativo",
    subtitle: "Indicadores básicos del tema (sin base ArcGIS/Excel oficial aún)",
    kpis: [
      { id: "n", label: "Registros", value: formatNumber(rows.length) },
      { id: "v", label: "Valor", value: formatCop(valor) },
    ],
    semaphores: orderSemaphores(sem),
    alerts: [],
    byLayer: layerBreakdown(rows),
    priorityList: [],
    focusLabel: "Sin lista prioritaria",
  };
}

export function buildDecisionBrief(
  themeId: string,
  rows: RecordRow[],
): DecisionBrief {
  if (!rows.length) {
    return {
      themeId,
      title: "Tablero de decisión",
      subtitle: "Sin registros cargados para este tema",
      kpis: [],
      semaphores: [],
      alerts: [
        {
          id: "empty",
          severity: "info",
          title: "Sin datos",
          detail:
            "Importe la base oficial o capture registros para activar semáforos y alertas.",
        },
      ],
      byLayer: [],
      priorityList: [],
      focusLabel: "—",
    };
  }

  switch (themeId) {
    case "fic":
      return buildFic(rows);
    case "agua-y-saneamiento":
      return buildAgua(rows);
    case "carrotanques":
      return buildCarrotanques(rows);
    case "banco-de-maquinaria":
      return buildBanco(rows);
    case "obras-de-emergencia":
      return buildObrasEmergencia(rows);
    case "obras-por-impuestos":
      return buildObrasImpuestos(rows);
    case "puentes":
      return buildPuentes(rows);
    case "declaratoria-de-emergencia":
      return buildDeclaratoria(rows);
    default:
      return buildGeneric(themeId, rows);
  }
}

/** Agrupa campos del formulario en secciones legibles (captura). */
export function groupCaptureFields(
  fields: { name: string; label: string }[],
): { id: string; title: string; names: string[] }[] {
  const names = fields.map((f) => f.name);
  const take = (pred: (n: string) => boolean) => {
    const hit = names.filter(pred);
    return hit;
  };
  const used = new Set<string>();
  const section = (id: string, title: string, list: string[]) => {
    const namesSec = list.filter((n) => !used.has(n));
    namesSec.forEach((n) => used.add(n));
    return { id, title, names: namesSec };
  };

  const sections = [
    section(
      "seguimiento",
      "Seguimiento y capa",
      take((n) =>
        /^(tipo_registro|capa|clave_seguimiento|orden_de_proveeduria|placa|serial|no_cdp|no_convenio|no_declaratoria|id)$/.test(
          n,
        ),
      ),
    ),
    section(
      "geo",
      "Ubicación",
      take((n) => /^(departamento|municipio|divipola|region|latitud|longitud)$/.test(n)),
    ),
    section(
      "nucleo",
      "Indicadores núcleo",
      take((n) => /^(valor|fecha|estado|observaciones)$/.test(n)),
    ),
    section(
      "fechas",
      "Fechas y plazos",
      take((n) => /fecha|plazo|dias_|día/i.test(n)),
    ),
    section(
      "financiero",
      "Financiero / pagos",
      take((n) =>
        /valor_|pago|cdp|rc|anticipo|desembol|legaliz|aporte|iva|cop/i.test(n),
      ),
    ),
    section(
      "tecnico",
      "Detalle técnico / operativo",
      take(() => true),
    ),
  ].filter((s) => s.names.length > 0);

  return sections;
}
