"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Link2, Plus, ChevronDown } from "lucide-react";
import type { ProcesoLookupHit } from "@/lib/records/puente-lookup";
import {
  inferTipoVinculo,
  normalizeClaveProceso,
} from "@/themes/puentes/process-keys";
import { readJson } from "@/lib/http/read-json";

export type { ProcesoLookupHit };

type Props = {
  themeId: string;
  selected: ProcesoLookupHit | null;
  onSelect: (hit: ProcesoLookupHit) => void;
  onClear: () => void;
  disabled?: boolean;
  /** Precarga desde puente seleccionado (contrato heredado). */
  initialQuery?: string;
  /**
   * Esta capa origina el proceso: permite usar el texto escrito como
   * contrato/donación nuevo cuando no existe todavía.
   */
  allowCreate?: boolean;
  /**
   * Catálogo de contratos:
   * - estructuracion: hoja Contratos Estructuración
   * - inventario: contratos de Base General (todos los puentes vinculados)
   */
  catalog?: "estructuracion" | "inventario";
};

/** Proceso nuevo a partir de lo que escribió el operador (aún no está en base). */
function draftProceso(term: string): ProcesoLookupHit {
  const contrato = term.trim();
  const tipo = inferTipoVinculo(contrato);
  return {
    id: "",
    contrato_convenio: contrato,
    clave_proceso: normalizeClaveProceso(contrato, tipo),
    tipo_vinculo: tipo,
    valor: "",
    vigencia: "",
    payload: {} as ProcesoLookupHit["payload"],
    puentes_vinculados: 0,
    etapas_registradas: 0,
    estructurado: false,
  };
}

export function ProcesoLookup({
  themeId,
  selected,
  onSelect,
  onClear,
  disabled,
  initialQuery,
  allowCreate,
  catalog = "estructuracion",
}: Props) {
  const [q, setQ] = useState(initialQuery || "");
  const [hits, setHits] = useState<ProcesoLookupHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /** Solo ofrecer crear si el texto no coincide con un proceso de la base. */
  const canCreate = useMemo(() => {
    const term = q.trim();
    if (!allowCreate || !term || loading || !touched) return false;
    const clave = normalizeClaveProceso(term).toLowerCase();
    return !hits.some(
      (h) =>
        h.clave_proceso.toLowerCase() === clave ||
        h.contrato_convenio.trim().toLowerCase() === term.toLowerCase(),
    );
  }, [allowCreate, q, hits, loading, touched]);

  useEffect(() => {
    if (initialQuery && !selected) setQ(initialQuery);
  }, [initialQuery, selected]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /**
   * Carga de la base solo cuando el operador abre el campo (focus/clic).
   * En reposo no se muestra la lista, para no saturar la vista.
   * Al enfocar: desplegable con lo que hay; al escribir: se filtra.
   */
  useEffect(() => {
    if (selected || !touched) return;
    const term = q.trim();
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/themes/${encodeURIComponent(themeId)}/procesos?q=${encodeURIComponent(term)}&limit=40&from=${catalog}`,
        );
        const parsed = await readJson<{
          error?: string;
          procesos?: ProcesoLookupHit[];
        }>(res);
        if (!parsed.ok) {
          setErr(parsed.error);
          setHits([]);
          return;
        }
        const list = parsed.data.procesos || [];
        setHits(list);
        setOpen(true);
      } catch {
        setErr("Error de conexión");
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, term ? 220 : 0);
    return () => clearTimeout(t);
  }, [q, themeId, selected, touched, catalog]);

  function openDropdown() {
    if (disabled) return;
    setTouched(true);
    setOpen(true);
  }

  if (selected) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase">
              <Link2 className="h-3.5 w-3.5" />
              {catalog === "inventario"
                ? "Contrato · puentes atados"
                : selected.estructurado && selected.id
                  ? "Proceso existente · modificar"
                  : "Proceso nuevo · registrar"}
            </p>
            <p className="mt-1 text-base font-extrabold text-ungrd-heading">
              {selected.contrato_convenio}
            </p>
            {selected.descripcion_proceso ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-ungrd-text">
                {selected.descripcion_proceso}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-ungrd-muted">
              Clave: {selected.clave_proceso} · vínculo: {selected.tipo_vinculo}
              {catalog === "inventario"
                ? ` · ${selected.puentes_vinculados || 0} puente(s) con ID único`
                : ""}
            </p>
            {catalog === "inventario" ? (
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Elija un puente de la lista o pulse «Nuevo puente» para atar otro
                ID único a este contrato.
              </p>
            ) : !selected.estructurado || !selected.id ? (
              <p className="mt-1 text-xs font-semibold text-amber-800">
                Aún no está en Estructuración: al guardar se registran todos los
                datos.
              </p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                Ya existe: al modificar solo cambian etapa y estado (el resto
                queda fijo, con trazabilidad).
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onClear();
              setQ("");
              setHits([]);
              setTouched(false);
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border bg-white px-3 py-1.5 text-xs font-bold text-ungrd-heading"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative space-y-2">
      <label className="block text-sm font-semibold text-ungrd-heading">
        Contrato / convenio / donación
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
          <input
            type="search"
            value={q}
            disabled={disabled}
            onChange={(e) => {
              setQ(e.target.value);
              setTouched(true);
            }}
            onFocus={openDropdown}
            onClick={openDropdown}
            placeholder="Seleccione de la lista o filtre escribiendo…"
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2.5 pr-10 pl-9 text-sm font-normal"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={disabled}
            tabIndex={-1}
            onClick={openDropdown}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ungrd-muted hover:text-ungrd-heading"
            aria-label="Abrir lista de contratos"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </label>

      {!touched ? (
        <p className="text-xs text-ungrd-muted">
          Haga clic para ver los contratos de la base y filtrarlos. Abajo puede
          llenar los campos para registrar uno nuevo sin seleccionar nada.
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-ungrd-muted">Cargando contratos de la base…</p>
      ) : null}
      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {open && touched ? (
        <ul className="max-h-56 overflow-auto rounded-xl border border-ungrd-border bg-white shadow-lg">
          {hits.length === 0 && !loading ? (
            <li className="px-3 py-2 text-sm text-ungrd-muted">
              {q.trim()
                ? `Ningún contrato coincide con «${q.trim()}».`
                : "No hay contratos en la base todavía."}
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.clave_proceso.toLowerCase()}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelect(h);
                    setOpen(false);
                  }}
                  className="w-full border-b border-ungrd-border px-3 py-2 text-left text-sm hover:bg-ungrd-surface last:border-0"
                >
                  <span className="font-semibold">{h.contrato_convenio}</span>
                  {catalog === "inventario" && (h.puentes_vinculados ?? 0) > 0 ? (
                    <span className="text-ungrd-muted">
                      {" "}
                      · {h.puentes_vinculados} puente
                      {h.puentes_vinculados === 1 ? "" : "s"}
                    </span>
                  ) : catalog === "inventario" ? (
                    <span className="text-ungrd-muted"> · sin puentes aún</span>
                  ) : null}
                  {h.descripcion_proceso && catalog === "estructuracion" ? (
                    <>
                      <br />
                      <span className="line-clamp-1 text-xs text-ungrd-muted">
                        {h.descripcion_proceso}
                      </span>
                    </>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {allowCreate && canCreate ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onSelect(draftProceso(q));
            setOpen(false);
          }}
          className="inline-flex w-full items-center gap-2 rounded-lg border border-dashed border-ungrd-navy/40 bg-ungrd-navy/[0.03] px-3 py-2.5 text-left text-sm font-semibold text-ungrd-navy hover:bg-ungrd-navy/[0.06]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>
            Registrar «{q.trim()}» como proceso nuevo
            <span className="block text-xs font-normal text-ungrd-muted">
              Clave: {normalizeClaveProceso(q.trim())} · vínculo:{" "}
              {inferTipoVinculo(q.trim())} · se crea al guardar en la base
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
