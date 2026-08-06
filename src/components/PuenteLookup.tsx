"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Link2 } from "lucide-react";
import {
  departmentNames,
  findDepartment,
  municipalityNames,
} from "@/lib/geo";
import type {
  PuenteFacetOption,
  PuenteFilterFacets,
  PuenteLookupHit,
} from "@/lib/records/puente-lookup";

export type { PuenteLookupHit };

export const PUENTE_CONTEXT_KEYS = [
  "id_puente",
  "clave_seguimiento",
  "codigo_operativo",
  "numero_unidad",
  "proceso_sigla",
  "origen_adquisicion",
  "clase",
  "tipo",
  "configuracion",
  "contrato_convenio",
  "convenio_o_cto",
  "tipo_vinculo",
  "clave_proceso",
  "ubicacion_actual",
  "region",
  "departamento",
  "municipio",
  "entidad_receptora",
  "estado_puente",
  "situacion_prestamo",
  "latitud",
  "longitud",
  "valor",
] as const;

const EMPTY_FACETS: PuenteFilterFacets = {
  procesos: [],
  convenios: [],
  contratos: [],
  origenes: [],
  tipos: [],
  configuraciones: [],
  ubicaciones: [],
  matching: 0,
  total: 0,
};

export function inheritFromInventario(
  hit: PuenteLookupHit,
  fieldNames: string[],
): Record<string, string> {
  const out: Record<string, string> = {
    id_puente: hit.id_puente,
    clave_seguimiento: hit.id_puente,
  };
  for (const key of PUENTE_CONTEXT_KEYS) {
    if (key === "id_puente" || key === "clave_seguimiento") continue;
    if (!fieldNames.includes(key)) continue;
    const v = hit.payload[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      out[key] = String(v);
    }
  }
  if (hit.ubicacion_actual && fieldNames.includes("ubicacion_actual")) {
    out.ubicacion_actual = hit.ubicacion_actual;
  }
  if (hit.codigo_operativo) out.codigo_operativo = hit.codigo_operativo;
  if (hit.convenio_o_cto) out.convenio_o_cto = hit.convenio_o_cto;
  else if (hit.contrato_convenio) out.convenio_o_cto = hit.contrato_convenio;
  return out;
}

/** Etiqueta principal del activo: ID único operativo del Excel. */
export function puenteLabel(hit: {
  codigo_operativo?: string;
  id_puente?: string;
}): string {
  const codigo = String(hit.codigo_operativo || "").trim();
  if (codigo) return codigo;
  const idp = String(hit.id_puente || "").trim();
  return idp ? `ID ${idp}` : "—";
}

function FacetSelect({
  label,
  value,
  options,
  disabled,
  placeholder = "Todos",
  hint,
  onChange,
}: {
  label: string;
  value: string;
  options: PuenteFacetOption[];
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-ungrd-heading">
      {label}
      <select
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} title={opt.title || opt.value}>
            {opt.label} ({opt.count})
          </option>
        ))}
      </select>
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-ungrd-muted">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

type Props = {
  themeId: string;
  capa: string;
  selected: PuenteLookupHit | null;
  onSelect: (hit: PuenteLookupHit) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function PuenteLookup({
  themeId,
  capa,
  selected,
  onSelect,
  onClear,
  disabled,
}: Props) {
  const [q, setQ] = useState("");
  const [proceso, setProceso] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [hits, setHits] = useState<PuenteLookupHit[]>([]);
  const [facets, setFacets] = useState<PuenteFilterFacets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const deptCanonical = findDepartment(departamento)?.name || departamento;
  const municipalities = useMemo(
    () => municipalityNames(deptCanonical),
    [deptCanonical],
  );
  const departmentOptions = useMemo(() => departmentNames(), []);

  const usingProcesoFacet = facets.procesos.length > 0;
  const procesoOptions = usingProcesoFacet
    ? facets.procesos
    : facets.convenios;

  const sortedHits = useMemo(() => {
    return hits.slice().sort((a, b) => {
      const ca = String(a.codigo_operativo || "");
      const cb = String(b.codigo_operativo || "");
      if (ca && cb) return ca.localeCompare(cb, "es", { numeric: true });
      const na = Number(a.id_puente);
      const nb = Number(b.id_puente);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return a.id_puente.localeCompare(b.id_puente, "es");
    });
  }, [hits]);

  const hasScope = Boolean(q.trim() || proceso || deptCanonical || municipio);

  useEffect(() => {
    if (selected) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        params.set("capa", capa);
        params.set("facets", "1");
        params.set("limit", hasScope ? "200" : "40");
        if (q.trim()) params.set("q", q.trim());
        if (proceso) {
          if (usingProcesoFacet) params.set("proceso", proceso);
          else params.set("convenio", proceso);
        }
        if (deptCanonical) params.set("departamento", deptCanonical);
        if (municipio) params.set("municipio", municipio);

        const res = await fetch(
          `/api/themes/${themeId}/puentes?${params.toString()}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || "No se pudo buscar");
          setHits([]);
          setFacets(EMPTY_FACETS);
          return;
        }
        setHits((data.puentes as PuenteLookupHit[]) || []);
        setFacets((data.facets as PuenteFilterFacets) || EMPTY_FACETS);
      } catch {
        setErr("Error de conexión al buscar puentes");
        setHits([]);
        setFacets(EMPTY_FACETS);
      } finally {
        setLoading(false);
      }
    }, q.trim() ? 220 : 120);
    return () => clearTimeout(t);
  }, [q, proceso, deptCanonical, municipio, themeId, capa, selected, hasScope, usingProcesoFacet]);

  if (selected) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase">
              <Link2 className="h-3.5 w-3.5" />
              Puente seleccionado · seguimiento
            </p>
            <p className="mt-1 text-lg font-extrabold break-all text-ungrd-heading">
              {puenteLabel(selected)}
            </p>
            <p className="mt-0.5 text-xs text-ungrd-muted">
              # interno {selected.id_puente}
              {selected.tipo ? ` · ${selected.tipo}` : ""}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Proceso (grupo)
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {selected.contrato_convenio || selected.convenio_o_cto || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Territorio
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {[selected.municipio, selected.departamento]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-ungrd-muted">
                  Estado
                </dt>
                <dd className="font-semibold text-ungrd-heading">
                  {selected.estado_puente || "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ungrd-muted">
              Complete abajo los campos actualizables de la bitácora. Cada
              guardado suma un evento de este ID único.
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onClear();
              setHits([]);
              setFacets(EMPTY_FACETS);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-ungrd-border bg-white px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar puente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ungrd-muted">
        Busque por el{" "}
        <strong className="text-ungrd-heading">ID único</strong> del Excel
        (ej.{" "}
        <code className="rounded bg-ungrd-surface px-1 text-[11px]">
          Donación - EEUU - 1-ACROW-18
        </code>{" "}
        o{" "}
        <code className="rounded bg-ungrd-surface px-1 text-[11px]">
          9677-…-BRIDGE-3
        </code>
        ). El proceso/convenio solo agrupa varios IDs; no es la llave del
        puente.
      </p>

      <label className="block text-sm font-semibold text-ungrd-heading">
        ID único del puente
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ungrd-muted" />
          <input
            type="search"
            value={q}
            disabled={disabled}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escriba el ID único o un fragmento (ACROW-18, BRIDGE-3…)"
            className="w-full rounded-lg border border-ungrd-navy/40 bg-ungrd-input py-2.5 pr-3 pl-9 text-sm font-normal ring-1 ring-ungrd-navy/10"
            autoComplete="off"
          />
        </div>
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FacetSelect
          label="Proceso (opcional · agrupa varios IDs)"
          value={proceso}
          options={procesoOptions}
          disabled={disabled}
          placeholder={
            procesoOptions.length === 0
              ? "Sin procesos en inventario"
              : "Todos los procesos"
          }
          hint="Ej. «Donación - EEUU - 1» tiene 10 IDs únicos (ACROW-18…27)."
          onChange={(v) => {
            setProceso(v);
            setDepartamento("");
            setMunicipio("");
          }}
        />
        <label className="block text-sm font-semibold text-ungrd-heading">
          Departamento
          <select
            value={departamento}
            disabled={disabled}
            onChange={(e) => {
              setDepartamento(e.target.value);
              setMunicipio("");
            }}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal disabled:opacity-60"
          >
            <option value="">Todos</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ungrd-heading">
          Municipio
          <select
            value={municipio}
            disabled={disabled || !deptCanonical}
            onChange={(e) => setMunicipio(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal disabled:opacity-60"
          >
            <option value="">Todos</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ungrd-muted">
        {loading ? (
          <span>Cargando puentes…</span>
        ) : (
          <span>
            {sortedHits.length} puente{sortedHits.length === 1 ? "" : "s"} ·
            elija por ID único
          </span>
        )}
        {hasScope ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setQ("");
              setProceso("");
              setDepartamento("");
              setMunicipio("");
            }}
            className="rounded-md border border-ungrd-border bg-white px-2 py-0.5 font-semibold text-ungrd-heading hover:border-ungrd-navy/40"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {err}
        </p>
      ) : null}

      {loading ? null : sortedHits.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {hasScope
            ? "Ningún puente coincide. Pruebe otro fragmento del ID único o limpie filtros."
            : "Escriba el ID único o elija un proceso para listar puentes."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ungrd-border bg-white">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-ungrd-surface">
              <tr>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  ID único
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  #
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  Tipo
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  Ubicación
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  Depto / Mpio
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  Estado
                </th>
                <th className="border-b border-ungrd-border px-2 py-1.5 font-bold">
                  Eventos
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHits.map((h) => (
                <tr
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!disabled) onSelect(h);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!disabled) onSelect(h);
                    }
                  }}
                  className="cursor-pointer odd:bg-white even:bg-ungrd-surface/40 hover:bg-ungrd-yellow/30"
                >
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5 font-semibold break-all text-ungrd-heading">
                    {puenteLabel(h)}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5 text-ungrd-muted">
                    {h.id_puente}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                    {h.tipo || "—"}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                    {h.ubicacion_actual || "—"}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                    {h.departamento || "—"} / {h.municipio || "—"}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                    {h.estado_puente || "—"}
                  </td>
                  <td className="border-b border-ungrd-border/60 px-2 py-1.5">
                    {h.eventos_bitacora ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-ungrd-border px-2 py-1.5 text-[11px] text-ungrd-muted">
            Clic en una fila para cargar ese ID único y habilitar la bitácora.
          </p>
        </div>
      )}
    </div>
  );
}
