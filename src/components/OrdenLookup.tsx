"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Link2 } from "lucide-react";
import { formatCop } from "@/lib/records/types";

export type OrdenLookupHit = {
  id: string;
  orden_de_proveeduria: string;
  orden_de_proveeduria_x_pago?: string;
  display_op?: string;
  match_kind?: "unica" | "x_pago";
  proveedor: string;
  nit: string;
  departamento: string;
  municipio: string;
  objeto: string;
  valor: number | string;
  vigencia: string;
  tipo_de_orden: string;
  fecha: string;
  payload: Record<string, string | number>;
};

function formatOrdenValor(valor: number | string | undefined): string {
  if (valor === undefined || valor === null || valor === "") return "—";
  const n =
    typeof valor === "number"
      ? valor
      : Number(String(valor).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) {
    const raw = String(valor).trim();
    return raw || "—";
  }
  if (n === 0) return "—";
  return formatCop(n);
}

function displayOpOf(hit: OrdenLookupHit): string {
  return (
    String(hit.display_op || "").trim() ||
    (hit.match_kind === "x_pago"
      ? String(hit.orden_de_proveeduria_x_pago || "").trim()
      : "") ||
    hit.orden_de_proveeduria
  );
}

type Props = {
  themeId: string;
  capa: string;
  selected: OrdenLookupHit | null;
  onSelect: (hit: OrdenLookupHit) => void;
  onClear: () => void;
  disabled?: boolean;
  /** Pagos: incluir OP única y OP por pago como resultados. */
  expandPaymentOps?: boolean;
};

export function OrdenLookup({
  themeId,
  capa,
  selected,
  onSelect,
  onClear,
  disabled,
  expandPaymentOps,
}: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OrdenLookupHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (selected) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        params.set("q", term);
        params.set("capa", capa);
        params.set("limit", "15");
        if (expandPaymentOps) params.set("expandPaymentOps", "1");
        const res = await fetch(
          `/api/themes/${encodeURIComponent(themeId)}/orders?${params.toString()}`,
        );
        const raw = await res.text();
        let data: { error?: string; orders?: OrdenLookupHit[] } = {};
        try {
          data = raw ? (JSON.parse(raw) as typeof data) : {};
        } catch {
          setErr(
            res.ok
              ? "Respuesta inválida al buscar órdenes"
              : `Error del servidor (${res.status}). ¿Base de datos caída?`,
          );
          setHits([]);
          return;
        }
        if (!res.ok) {
          setErr(data.error || `No se pudo buscar (${res.status})`);
          setHits([]);
          return;
        }
        setHits(data.orders || []);
        if (term.length >= 1 || (data.orders?.length ?? 0) > 0) {
          setOpen(true);
        }
      } catch (e) {
        const detail =
          e instanceof Error && e.message
            ? e.message
            : "Error de conexión al buscar órdenes";
        setErr(
          detail.includes("pattern") || detail.includes("JSON")
            ? "No se pudo leer la respuesta del servidor al buscar órdenes"
            : detail,
        );
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, term.length === 0 ? 0 : 280);
    return () => clearTimeout(t);
  }, [q, themeId, capa, selected, expandPaymentOps]);

  if (selected) {
    const shown = displayOpOf(selected);
    const isPago = selected.match_kind === "x_pago";
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase">
              <Link2 className="h-3.5 w-3.5" />
              {isPago ? "OP por pago (ligada al alta)" : "OP del registro inicial"}
            </p>
            <p className="mt-1 text-lg font-extrabold text-ungrd-heading">
              {shown}
            </p>
            {isPago &&
            selected.orden_de_proveeduria &&
            selected.orden_de_proveeduria !== shown ? (
              <p className="mt-0.5 text-xs font-semibold text-ungrd-muted">
                OP única: {selected.orden_de_proveeduria}
              </p>
            ) : null}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Proveedor
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {selected.proveedor || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  NIT
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {selected.nit || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Valor de la orden
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {formatOrdenValor(selected.valor)}
                </dd>
              </div>
              {String(selected.payload?.estado_actual || selected.payload?.estado || "").trim() ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                    Estado actual
                  </dt>
                  <dd className="font-semibold text-ungrd-heading">
                    {String(
                      selected.payload?.estado_actual ||
                        selected.payload?.estado ||
                        "",
                    )}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Tipo de orden
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {selected.tipo_de_orden ||
                    String(selected.payload?.tipo_de_orden || "") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Ubicación
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {[selected.municipio, selected.departamento]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Objeto
                </dt>
                <dd className="line-clamp-2 text-ungrd-text">
                  {selected.objeto || "—"}
                </dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onClear();
              setQ("");
              setHits([]);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border bg-white px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar OP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative space-y-2">
      <label className="block text-sm font-semibold text-ungrd-heading">
        Buscar orden del registro inicial
        <span className="ml-1 text-ungrd-danger" aria-hidden>
          *
        </span>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
          <input
            type="search"
            value={q}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={
              expandPaymentOps
                ? "OP única o OP x pago… proveedor, municipio, NIT"
                : "Ej. GS-SMD-006… proveedor, municipio, NIT"
            }
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2.5 pr-3 pl-10 text-sm font-normal text-ungrd-text outline-none focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40"
            autoComplete="off"
          />
        </div>
      </label>
      <p className="text-xs text-ungrd-muted">
        {expandPaymentOps
          ? "Órdenes del alta: aparece la OP única y, si existe, la OP por pago. Al elegir cualquiera se hereda el contexto de la OP de negocio."
          : "Órdenes de la base real (Maqueta / Alta). Escriba GS- u otra OP y seleccione; los datos comunes se heredan."}
      </p>
      {loading ? (
        <p className="text-xs font-semibold text-ungrd-muted">Buscando…</p>
      ) : null}
      {err ? (
        <p className="text-xs font-semibold text-ungrd-danger">{err}</p>
      ) : null}
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-ungrd-border bg-white shadow-lg">
          {hits.map((h) => {
            const shown = displayOpOf(h);
            const isPago = h.match_kind === "x_pago";
            const rowKey = `${h.id}:${h.match_kind || "unica"}:${shown}`;
            return (
              <li key={rowKey}>
                <button
                  type="button"
                  className="w-full border-b border-ungrd-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-ungrd-navy/[0.04]"
                  onClick={() => {
                    onSelect(h);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-ungrd-heading">
                      {shown}
                    </span>
                    {expandPaymentOps ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                          isPago
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {isPago ? "OP x pago" : "OP única"}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-ungrd-muted">
                    {[
                      isPago && h.orden_de_proveeduria !== shown
                        ? `OP única: ${h.orden_de_proveeduria}`
                        : null,
                      h.proveedor,
                      h.municipio,
                      h.departamento,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin detalle"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && !loading && q.trim() && hits.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No hay coincidencias con «{q.trim()}». Pruebe otro fragmento de OP
          (p. ej. GS-SMD) o el nombre del proveedor.
        </p>
      ) : null}
    </div>
  );
}

/** Campos del alta que se muestran/heredan y no se piden de nuevo. */
export const ALTA_CONTEXT_KEYS = [
  "orden_de_proveeduria",
  "clave_seguimiento",
  "orden_de_proveeduria_x_pago",
  "nit",
  "proveedor",
  "departamento",
  "municipio",
  "objeto",
  "valor",
  "vigencia",
  "tipo_de_orden",
  "region",
  "provincia",
  "fecha",
] as const;

export function inheritFromAlta(
  hit: OrdenLookupHit,
  fieldNames: string[],
): Record<string, string> {
  const mainOp = hit.orden_de_proveeduria;
  const out: Record<string, string> = {
    orden_de_proveeduria: mainOp,
    clave_seguimiento: mainOp,
  };
  for (const key of ALTA_CONTEXT_KEYS) {
    if (
      key === "orden_de_proveeduria" ||
      key === "clave_seguimiento" ||
      key === "orden_de_proveeduria_x_pago"
    ) {
      continue;
    }
    if (!fieldNames.includes(key)) continue;
    const v = hit.payload[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      out[key] = String(v);
    }
  }
  // Prefill hit summary fields even if only used for context
  if (hit.proveedor) out.proveedor = hit.proveedor;
  if (hit.nit && fieldNames.includes("nit")) out.nit = hit.nit;
  if (
    fieldNames.includes("valor") &&
    hit.valor !== undefined &&
    hit.valor !== null &&
    String(hit.valor).trim() !== "" &&
    (!out.valor || out.valor === "0")
  ) {
    out.valor = String(hit.valor);
  }
  if (fieldNames.includes("orden_de_proveeduria_x_pago")) {
    const payment =
      hit.match_kind === "x_pago"
        ? displayOpOf(hit)
        : String(
            hit.orden_de_proveeduria_x_pago ||
              hit.payload?.orden_de_proveeduria_x_pago ||
              "",
          ).trim();
    if (payment) out.orden_de_proveeduria_x_pago = payment;
  }
  return out;
}
