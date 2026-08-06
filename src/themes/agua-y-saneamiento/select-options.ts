/**
 * Listas Agua y Saneamiento — copiadas 1:1 de Excel oficial.
 *
 * Fuentes:
 * - Bitácora · hoja `estados` → macro / estado / proceso / dependencia / apoyo
 * - Maqueta · hoja `LISTAS` → forma de pago / tipo modificación / modificación
 * - Maqueta · columna Tipo de Evento
 * - Bitácora · hoja `CDPS Y RC` → columnas CDP / RC (estado, no el N°)
 *
 * No mezclar columnas: cada campo solo recibe su lista.
 */

/** Bitácora `estados` · Estado macro-producto */
export const AGUA_ESTADO_MACRO = [
  "Expediente",
  "Aval",
  "Informe Sopena",
  "Informe de cierre",
  "Informe de supervision",
  "Ratificación",
  "Solicitud de pago",
  "Pagado",
] as const;

/** Bitácora `estados` · Estado */
export const AGUA_ESTADO = [
  "Revision inicial de expediente",
  "Tramite de Aval tecnico",
  "Con aval",
  "Tramite de informe Sopena",
  "Tramite de informe de cierre",
  "Tramite de informe de supervisión",
  "Tramite de Solicitud de ratificación",
  "Tramite de Solicitud de Pago",
  "Pagado con CE",
] as const;

/** Bitácora `estados` · proceso */
export const AGUA_PROCESO = [
  "En revisión",
  "En revision de observaciones",
  "Reiterado",
  "En actualización de documentos",
  "En proyección",
  "En firma",
  "Tramite finalizado",
  "Radicado",
  "Vbo",
  "Asignacion",
  "En levantamiento de informacion",
  "Proceso Detenido",
] as const;

/** Bitácora `estados` · Dependencia */
export const AGUA_DEPENDENCIA = [
  "Área técnica",
  "Proveedor",
  "Contratista",
  "Ente Territorial",
  "Área Financiera",
  "Punto de control M.A",
  "Área Contractual",
  "Punto de control Contractual",
  "Lider contractual",
  "Subdirector SMD",
  "Subdirector General",
  "Fiduprevisora",
  "GAFC",
  "Secretaria General",
] as const;

/**
 * Bitácora `estados` · apoyo a la supervision
 * (= estado de ejecución en bitácora estructuración)
 */
export const AGUA_ESTADO_EJECUCION = [
  "En ejecución",
  "culminado",
  "Sin iniciar",
  "Culminado, Sin radicar expediente",
] as const;

/** Maqueta LISTAS · Forma de Pago */
export const AGUA_FORMA_DE_PAGO = [
  "Único Pago",
  "2 Pagos",
  "3 Pagos",
] as const;

/**
 * Maqueta LISTAS · Tipo de modificación
 * + PRORROGA (pedido operativo; no estaba en LISTAS).
 */
export const AGUA_TIPO_MODIFICACION = [
  "ALCANCE",
  "ADICION",
  "MODIFICACION",
  "PRORROGA",
] as const;

/** Maqueta LISTAS · Modificación (qué cambia) */
export const AGUA_MODIFICACION = [
  "Valor OP",
  "Horas Maquina",
  "Dias Volqueta",
  "Plazo Ejecucion",
  "Forma de Pago",
  "Aclaratorio",
] as const;

/** Maqueta · Tipo de Evento */
export const AGUA_TIPO_DE_EVENTO = [
  "Temporada de lluvias",
  "Temporada de Sequía",
  "Calamidad pública",
  "Situación de desastre de carácter nacional",
  "RESPUESTA Y RECUPERACIÓN",
  "Variabilidad Climática",
  "Actividad Volcánica",
  "sin info",
] as const;

/**
 * Bitácora `CDPS Y RC` · columna CDP (estado).
 * Valores distintos en Excel: Con CDP · Sin cdp · CDP ANULADO.
 * Canonical title-style; aliases conservan casing legacy en import.
 */
export const AGUA_CDP = ["Con CDP", "Sin CDP", "CDP Anulado"] as const;

/**
 * Bitácora `CDPS Y RC` · columna RC (estado).
 * Valores distintos: Con RC · Sin RC · sin info.
 */
export const AGUA_RC = ["Con RC", "Sin RC", "sin info"] as const;

const AGUA_TIPO_DE_EVENTO_ALIASES: Record<
  string,
  (typeof AGUA_TIPO_DE_EVENTO)[number]
> = {
  "temporada de lluvia": "Temporada de lluvias",
  "temporada de lluvias": "Temporada de lluvias",
  "temporada de sequia": "Temporada de Sequía",
  "temporada de sequía": "Temporada de Sequía",
  "temporada seca": "Temporada de Sequía",
  "calamidad publica": "Calamidad pública",
  "calamidad pública": "Calamidad pública",
  "variabilidad climatica": "Variabilidad Climática",
  "variabilidad climática": "Variabilidad Climática",
  "actividad volcanica": "Actividad Volcánica",
  "actividad volcánica": "Actividad Volcánica",
  "respuesta y recuperación": "RESPUESTA Y RECUPERACIÓN",
  "situación de desastre de carácter nacional":
    "Situación de desastre de carácter nacional",
  "sin info": "sin info",
};

export function normalizeAguaTipoDeEvento(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const hit = AGUA_TIPO_DE_EVENTO_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  const exact = AGUA_TIPO_DE_EVENTO.find(
    (o) => o.toLowerCase() === s.toLowerCase(),
  );
  return exact || s;
}

const AGUA_TIPO_MOD_ALIASES: Record<
  string,
  (typeof AGUA_TIPO_MODIFICACION)[number]
> = {
  alcance: "ALCANCE",
  adicion: "ADICION",
  adición: "ADICION",
  modificacion: "MODIFICACION",
  modificación: "MODIFICACION",
  prorroga: "PRORROGA",
  prórroga: "PRORROGA",
};

export function normalizeAguaTipoModificacion(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const hit = AGUA_TIPO_MOD_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  const exact = AGUA_TIPO_MODIFICACION.find(
    (o) => o.toLowerCase() === s.toLowerCase(),
  );
  return exact || s;
}

const AGUA_CDP_ALIASES: Record<string, (typeof AGUA_CDP)[number]> = {
  "con cdp": "Con CDP",
  "con cpd": "Con CDP", // typo legacy
  "sin cdp": "Sin CDP",
  "sin cpd": "Sin CDP",
  "cdp anulado": "CDP Anulado",
  "cdp anulado.": "CDP Anulado",
  "cpd anulado": "CDP Anulado",
  "cdp_anulado": "CDP Anulado",
};

export function normalizeAguaCdp(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const hit = AGUA_CDP_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  const exact = AGUA_CDP.find((o) => o.toLowerCase() === s.toLowerCase());
  return exact || s;
}

const AGUA_RC_ALIASES: Record<string, (typeof AGUA_RC)[number]> = {
  "con rc": "Con RC",
  "sin rc": "Sin RC",
  "sin info": "sin info",
  "sin información": "sin info",
  "sin informacion": "sin info",
};

export function normalizeAguaRc(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const hit = AGUA_RC_ALIASES[s.toLowerCase()];
  if (hit) return hit;
  const exact = AGUA_RC.find((o) => o.toLowerCase() === s.toLowerCase());
  return exact || s;
}

/** Aplica options a FormField[] por nombre de campo. */
export function applyAguaSelectOptions<
  T extends { name: string; type: string; options?: string[] },
>(fields: T[]): T[] {
  const map: Record<string, readonly string[]> = {
    estado_macro: AGUA_ESTADO_MACRO,
    estado: AGUA_ESTADO,
    estado_de_ejecucion: AGUA_ESTADO_EJECUCION,
    // Maqueta consolidada: puede mostrar trámite o ejecución
    estado_actual: [...AGUA_ESTADO, ...AGUA_ESTADO_EJECUCION],
    proceso: AGUA_PROCESO,
    proceso_actual: AGUA_PROCESO,
    dependencia: AGUA_DEPENDENCIA,
    forma_de_pago: AGUA_FORMA_DE_PAGO,
    tipo_de_modificacion: AGUA_TIPO_MODIFICACION,
    modificacion: AGUA_MODIFICACION,
    tipo_de_evento: AGUA_TIPO_DE_EVENTO,
    // CDPS Y RC · estado (no el N°)
    no_cdp: AGUA_CDP,
    no_rc: AGUA_RC,
  };

  return fields.map((f) => {
    const opts = map[f.name];
    if (!opts?.length) return f;
    const unique = [...new Set(opts.map(String))];
    return {
      ...f,
      type: "select" as T["type"],
      options: unique,
    };
  });
}
