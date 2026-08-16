/**
 * Cadena de alimentación Puentes: proceso → puente → evento.
 *
 * Regla única sobre el contrato:
 *  - **Contrato estructuración** es el único punto donde nace `contrato_convenio`.
 *  - **Inventario puente** solo puede referenciar un proceso que ya exista.
 *  - **Bitácora estado** nunca declara contrato: lo hereda del puente.
 *
 * Se aplica en el servidor para que la regla valga también fuera de la UI.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import { dbToRow } from "@/lib/records/db-to-row";
import {
  normalizePuenteCapa,
  puenteCapaLookupVariants,
} from "./capture-forms";
import { normalizeClaveProceso } from "./process-keys";

const THEME_ID = "puentes";

export const CAPA_ESTRUCTURACION = "Contrato estructuración";
export const CAPA_INVENTARIO = "Inventario puente";
export const CAPA_BITACORA = "Bitácora estado";

export type ProcesoChainResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; error: string };

function capaFilter(capa: string) {
  const variants = puenteCapaLookupVariants(capa);
  return sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;
}

function alive() {
  return and(eq(records.themeId, THEME_ID), isNull(records.deletedAt));
}

/** ¿La clave de proceso ya existe en alguna de estas capas? */
async function claveExisteEn(capa: string, clave: string): Promise<boolean> {
  const rows = await db
    .select({ contrato: sql<string>`${records.payload}->>'contrato_convenio'` })
    .from(records)
    .where(
      and(
        alive(),
        capaFilter(capa),
        sql`coalesce(${records.payload}->>'contrato_convenio','') <> ''`,
      ),
    );
  const target = clave.toLowerCase();
  return rows.some(
    (r) => normalizeClaveProceso(String(r.contrato || "")).toLowerCase() === target,
  );
}

/** Llaves del proceso del puente inventariado (fuente para la bitácora). */
async function procesoDelPuente(idPuente: string): Promise<{
  contrato_convenio: string;
  clave_proceso: string;
  tipo_vinculo: string;
  convenio_o_cto: string;
} | null> {
  const id = idPuente.trim().toLowerCase();
  if (!id) return null;
  const [row] = await db
    .select()
    .from(records)
    .where(
      and(
        alive(),
        capaFilter(CAPA_INVENTARIO),
        sql`(
          lower(trim(coalesce(${records.payload}->>'id_puente',''))) = ${id}
          OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${id}
        )`,
      ),
    )
    .limit(1);

  if (!row) return null;
  const r = dbToRow(row);
  const contrato = String(r.contrato_convenio || r.contrato || "");
  return {
    contrato_convenio: contrato,
    clave_proceso: String(r.clave_proceso || ""),
    tipo_vinculo: String(r.tipo_vinculo || ""),
    convenio_o_cto: String(r.convenio_o_cto || contrato || ""),
  };
}

/** Campos que definen la identidad del proceso contractual. */
const PROCESO_KEYS = [
  "contrato_convenio",
  "contrato",
  "clave_proceso",
  "tipo_vinculo",
] as const;

/**
 * Quita del patch las llaves del proceso cuando el registro editado no
 * pertenece a Estructuración: el contrato no se reescribe desde una capa hija.
 */
export async function sanitizePuentePatch(
  recordId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const touchesProceso = PROCESO_KEYS.some((k) => k in patch);
  if (!touchesProceso) return patch;

  const [row] = await db
    .select({
      capa: sql<string>`coalesce(${records.payload}->>'capa', ${records.payload}->>'tipo_registro','')`,
    })
    .from(records)
    .where(and(eq(records.id, recordId), isNull(records.deletedAt)))
    .limit(1);

  const capa = normalizePuenteCapa(String(row?.capa || ""));
  if (capa === CAPA_ESTRUCTURACION) return patch;

  const out = { ...patch };
  for (const key of PROCESO_KEYS) delete out[key];
  return out;
}

/**
 * Ajusta y valida una fila según la capa a la que pertenece.
 * Devuelve los valores corregidos o el motivo del rechazo.
 */
export async function enforceProcesoChain(
  values: Record<string, unknown>,
): Promise<ProcesoChainResult> {
  const out = { ...values };
  const capa = normalizePuenteCapa(
    String(out.capa ?? out.tipo_registro ?? ""),
  );

  if (capa === CAPA_ESTRUCTURACION) {
    // Aquí nace el contrato: nada que heredar ni que verificar aguas arriba.
    return { ok: true, values: out };
  }

  if (capa === CAPA_INVENTARIO) {
    const contrato = String(out.contrato_convenio || out.contrato || "").trim();
    if (!contrato) {
      return {
        ok: false,
        error:
          "El puente debe nacer de un proceso: seleccione el contrato o convenio ya estructurado.",
      };
    }
    const clave = normalizeClaveProceso(contrato);
    const estructurado = await claveExisteEn(CAPA_ESTRUCTURACION, clave);
    if (!estructurado) {
      // Se admite un proceso heredado de cargas previas, pero no uno inédito:
      // el contrato no puede nacer desde el inventario.
      const conocido = await claveExisteEn(CAPA_INVENTARIO, clave);
      if (!conocido) {
        return {
          ok: false,
          error: `El contrato «${contrato}» no existe en la capa Estructuración. Regístrelo primero en «1 · Estructuración del proceso»; el contrato solo se crea allí.`,
        };
      }
    }
    // Llave de seguimiento en bitácora (Convenio o CTO) = contrato del que nace.
    if (!String(out.convenio_o_cto || "").trim()) {
      out.convenio_o_cto = contrato;
    }
    return { ok: true, values: out };
  }

  if (capa === CAPA_BITACORA) {
    const idPuente = String(out.id_puente || out.clave_seguimiento || "").trim();
    if (!idPuente) {
      return {
        ok: false,
        error: "La bitácora requiere el puente del inventario al que hace seguimiento.",
      };
    }
    const proceso = await procesoDelPuente(idPuente);
    if (!proceso) {
      return {
        ok: false,
        error: `El puente ${idPuente} no está en el inventario. Regístrelo en «Inventario del puente» antes de abrir la bitácora.`,
      };
    }
    // El evento nunca declara contrato: siempre el del puente.
    if (proceso.contrato_convenio) {
      out.contrato_convenio = proceso.contrato_convenio;
      out.clave_proceso = proceso.clave_proceso;
      out.tipo_vinculo = proceso.tipo_vinculo;
    } else {
      delete out.contrato_convenio;
      delete out.clave_proceso;
      delete out.tipo_vinculo;
    }
    out.convenio_o_cto =
      proceso.convenio_o_cto || proceso.contrato_convenio || out.convenio_o_cto;
    return { ok: true, values: out };
  }

  return { ok: true, values: out };
}
