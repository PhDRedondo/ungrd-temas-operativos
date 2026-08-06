/**
 * Llaves de proceso contractual (contrato / donación) para capa Estructuración.
 * Muchos puentes pueden compartir la misma clave_proceso.
 */

export type TipoVinculo = "contrato" | "donacion" | "otro";

export function inferTipoVinculo(contratoConvenio: string): TipoVinculo {
  const s = String(contratoConvenio || "").trim().toLowerCase();
  if (!s) return "otro";
  if (/donaci[oó]n|donacion|donated|donation/i.test(s)) return "donacion";
  return "contrato";
}

/** Slug estable para cruce inventario ↔ estructuración. */
export function slugProceso(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function normalizeClaveProceso(
  contratoConvenio: string,
  tipoVinculo?: TipoVinculo,
): string {
  const raw = String(contratoConvenio || "").trim();
  if (!raw) return "";
  const tipo = tipoVinculo || inferTipoVinculo(raw);
  const slug = slugProceso(raw);
  if (!slug) return "";
  if (tipo === "donacion") return `DON:${slug}`;
  return slug;
}

/** Rellena tipo_vinculo + clave_proceso en fila de import/captura. */
export function applyProcesoKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  const contrato = String(
    out.contrato_convenio ?? out.contrato ?? "",
  ).trim();
  if (contrato) {
    out.contrato_convenio = contrato;
    const tipo = String(out.tipo_vinculo || "").trim() as TipoVinculo;
    out.tipo_vinculo =
      tipo && ["contrato", "donacion", "otro"].includes(tipo)
        ? tipo
        : inferTipoVinculo(contrato);
    out.clave_proceso = normalizeClaveProceso(
      contrato,
      out.tipo_vinculo as TipoVinculo,
    );
  }
  return out;
}
