/**
 * Llaves derivadas del activo puente (no reemplazan id_puente).
 *
 * Nivel 1 proceso  → clave_proceso / proceso_sigla / origen_adquisicion
 * Nivel 2 activo   → id_puente (canónico) + codigo_operativo (alias legible)
 * Nivel 3 evento   → records.id (UUID) + fecha_inicio
 *
 * codigo_operativo se calcula, nunca se captura a mano: sigla del proceso +
 * número de unidad dentro de ese proceso (orden estable por id_puente).
 */
import { inferTipoVinculo, normalizeClaveProceso, type TipoVinculo } from "./process-keys";

export type OrigenAdquisicion =
  | "donacion_eeuu"
  | "donacion_otra"
  | "contrato_nacional"
  | "sin_definir";

export const PUENTES_ORIGEN_ADQUISICION: OrigenAdquisicion[] = [
  "donacion_eeuu",
  "donacion_otra",
  "contrato_nacional",
  "sin_definir",
];

export const ORIGEN_LABELS: Record<OrigenAdquisicion, string> = {
  donacion_eeuu: "Donación EEUU",
  donacion_otra: "Otra donación",
  contrato_nacional: "Contrato nacional",
  sin_definir: "Sin definir",
};

const EEUU_RE =
  /estados\s*unidos|eeuu|e\.?\s*e\.?\s*u\.?\s*u\.?|\busa\b|united\s*states|departamento\s+de\s+defensa/i;

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function inferOrigenAdquisicion(
  contratoConvenio: string,
  tipoVinculo?: TipoVinculo,
): OrigenAdquisicion {
  const raw = String(contratoConvenio || "").trim();
  if (!raw) return "sin_definir";
  const tipo = tipoVinculo || inferTipoVinculo(raw);
  if (tipo === "donacion") {
    return EEUU_RE.test(stripAccents(raw)) ? "donacion_eeuu" : "donacion_otra";
  }
  if (tipo === "contrato") return "contrato_nacional";
  return "sin_definir";
}

/** Sigla corta y estable del proceso, legible para operación de campo. */
export function procesoSigla(
  contratoConvenio: string,
  tipoVinculo?: TipoVinculo,
): string {
  const raw = String(contratoConvenio || "").trim();
  if (!raw) return "";
  const origen = inferOrigenAdquisicion(raw, tipoVinculo);
  if (origen === "donacion_eeuu") return "DON-EEUU";

  const plain = stripAccents(raw).toUpperCase();
  const codigo = plain.match(/[0-9]{3,}[A-Z0-9-]*(?:-[A-Z0-9]+)*/)?.[0] || "";

  if (origen === "donacion_otra") {
    const words = plain
      .replace(/DONACION(ES)?/g, " ")
      .split(/[^A-Z0-9]+/)
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .join("-");
    return `DON-${words || codigo || "OTRA"}`.slice(0, 24);
  }
  if (codigo) return `CTO-${codigo}`.slice(0, 32);
  const words = plain
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join("-");
  return `CTO-${words || "SIN-CODIGO"}`.slice(0, 32);
}

/** Orden numérico si el id es numérico; alfabético como respaldo. */
export function comparePuenteIds(a: string, b: string): number {
  const na = Number(String(a).replace(/[^\d]/g, ""));
  const nb = Number(String(b).replace(/[^\d]/g, ""));
  const aNum = Number.isFinite(na) && String(a).match(/\d/);
  const bNum = Number.isFinite(nb) && String(b).match(/\d/);
  if (aNum && bNum && na !== nb) return na - nb;
  return String(a).localeCompare(String(b), "es");
}

export function buildCodigoOperativo(
  sigla: string,
  numeroUnidad: number | string,
): string {
  const s = String(sigla || "").trim();
  const n = Number(numeroUnidad);
  if (!s || !Number.isFinite(n) || n <= 0) return "";
  return `${s}-${String(n).padStart(2, "0")}`;
}

/**
 * Asigna numero_unidad + codigo_operativo a los puentes de inventario,
 * agrupando por clave_proceso y ordenando por id_puente.
 * Devuelve mapa id_puente → llaves derivadas. No crea ni borra registros.
 */
export function assignAssetKeys(
  inventario: { id_puente: string; contrato_convenio: string; tipo_vinculo?: string }[],
): Map<
  string,
  {
    id_puente: string;
    clave_proceso: string;
    proceso_sigla: string;
    origen_adquisicion: OrigenAdquisicion;
    numero_unidad: number;
    codigo_operativo: string;
  }
> {
  const byProceso = new Map<string, typeof inventario>();
  for (const row of inventario) {
    const idp = String(row.id_puente || "").trim();
    if (!idp) continue;
    const tipo = (String(row.tipo_vinculo || "").trim() || undefined) as
      | TipoVinculo
      | undefined;
    const clave = normalizeClaveProceso(row.contrato_convenio, tipo) || "SIN-PROCESO";
    const list = byProceso.get(clave) || [];
    list.push(row);
    byProceso.set(clave, list);
  }

  const out = new Map<
    string,
    {
      id_puente: string;
      clave_proceso: string;
      proceso_sigla: string;
      origen_adquisicion: OrigenAdquisicion;
      numero_unidad: number;
      codigo_operativo: string;
    }
  >();

  for (const [clave, rows] of byProceso) {
    const sorted = [...rows].sort((a, b) =>
      comparePuenteIds(a.id_puente, b.id_puente),
    );
    sorted.forEach((row, index) => {
      const tipo = (String(row.tipo_vinculo || "").trim() || undefined) as
        | TipoVinculo
        | undefined;
      const sigla = procesoSigla(row.contrato_convenio, tipo);
      const numero = index + 1;
      out.set(String(row.id_puente).trim(), {
        id_puente: String(row.id_puente).trim(),
        clave_proceso: clave === "SIN-PROCESO" ? "" : clave,
        proceso_sigla: sigla,
        origen_adquisicion: inferOrigenAdquisicion(row.contrato_convenio, tipo),
        numero_unidad: numero,
        codigo_operativo: buildCodigoOperativo(sigla, numero),
      });
    });
  }
  return out;
}

/**
 * Variantes de búsqueda para un término escrito por el operador.
 * "EEUU 3", "eeuu-3", "don eeuu 03" → DON-EEUU-03
 * "ACROW-18", "BRIDGE-3", fragmento del ID único Excel → coincidencia parcial
 */
export function expandSearchAliases(term: string): string[] {
  const raw = String(term || "").trim();
  if (!raw) return [];
  const out = new Set<string>([raw]);
  const plain = stripAccents(raw).toUpperCase();
  out.add(plain);

  const num = plain.match(/(\d{1,3})\s*$/)?.[1];
  const hasEeuu = EEUU_RE.test(plain) || /\bEEUU\b/.test(plain);
  if (hasEeuu && num) {
    const n = Number(num);
    out.add(buildCodigoOperativo("DON-EEUU", n));
    out.add(`DON-EEUU-${n}`);
    out.add(`ACROW-${n}`);
    out.add(`Donación - EEUU - 1-ACROW-${n}`);
    out.add(`DONACION - EEUU - 1-ACROW-${n}`);
  }
  if (hasEeuu && !num) out.add("DON-EEUU");

  const acrow = plain.match(/ACROW[- ]?(\d{1,3})/);
  if (acrow) {
    out.add(`ACROW-${Number(acrow[1])}`);
    out.add(`Donación - EEUU - 1-ACROW-${Number(acrow[1])}`);
  }
  const bridge = plain.match(/BRIDGE[- ]?(\d{1,3})/);
  if (bridge) {
    out.add(`BRIDGE-${Number(bridge[1])}`);
    out.add(`3S-BRIDGE-${Number(bridge[1])}`);
  }

  const codigoMatch = plain.match(/^([A-Z]{2,4}(?:-[A-Z]{2,6})?)-?(\d{1,3})$/);
  if (codigoMatch) {
    out.add(buildCodigoOperativo(codigoMatch[1], Number(codigoMatch[2])));
  }
  return [...out].filter(Boolean);
}
