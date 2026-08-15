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
  /**
   * Identidad del lookup: `placa` | `serial` | `convenio` | `orden` (default).
   * Si no se pasa, se infiere por themeId (Carrotanques → placa).
   */
  lookupBy?: "orden" | "placa" | "serial" | "convenio" | "contrato";
};

export function OrdenLookup({
  themeId,
  capa,
  selected,
  onSelect,
  onClear,
  disabled,
  expandPaymentOps,
  lookupBy: lookupByProp,
}: Props) {
  const lookupBy: "orden" | "placa" | "serial" | "convenio" | "contrato" =
    lookupByProp ||
    (themeId === "carrotanques" ? "placa" : "orden");
  const byPlaca = lookupBy === "placa";
  const bySerial = lookupBy === "serial";
  const byConvenio = lookupBy === "convenio";
  const byContrato = lookupBy === "contrato";
  const byAsset = byPlaca || bySerial || byConvenio || byContrato;
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
        // Contrato/convenio Banco: listar más claves al abrir (hay ~45+).
        params.set("limit", byContrato || byConvenio ? "40" : "15");
        if (expandPaymentOps) params.set("expandPaymentOps", "1");
        if (lookupBy && lookupBy !== "orden") params.set("lookupBy", lookupBy);
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
              ? "Respuesta inválida al buscar"
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
            : "Error de conexión al buscar";
        setErr(detail);
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, term.length === 0 ? 0 : 280);
    return () => clearTimeout(t);
  }, [q, themeId, capa, selected, expandPaymentOps, lookupBy]);

  if (selected && byPlaca) {
    const placa = displayOpOf(selected);
    const p = selected.payload || {};
    const marca = String(p.marca || "").trim();
    const serial = String(p.serial || "").trim();
    const modelo = String(p.modelo_ref || p.modelo || "").trim();
    const anoCompra = String(p.ano_compra || "").trim();
    const capacidadLt = String(p.capacidad_lt || "").trim();
    const placaUngrd = String(p.placa_ungrd || "").trim();
    const clase = String(p.clase || "").trim();
    const rows: { label: string; value: string }[] = [
      { label: "Marca", value: marca },
      { label: "Serial", value: serial },
      { label: "Modelo", value: modelo },
      { label: "Año de compra", value: anoCompra },
      { label: "Capacidad (litros)", value: capacidadLt },
    ];
    if (placaUngrd) rows.unshift({ label: "Placa UNGRD", value: placaUngrd });
    if (clase) rows.splice(placaUngrd ? 2 : 1, 0, { label: "Clase", value: clase });

    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase dark:text-emerald-200">
              <Link2 className="h-3.5 w-3.5" />
              Placa de la maqueta
            </p>
            <p className="mt-1 text-lg font-extrabold text-emerald-950 dark:text-emerald-50">
              {placa}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                    {row.label}
                  </dt>
                  <dd className="font-semibold break-all text-emerald-950 dark:text-emerald-50">
                    {row.value || "—"}
                  </dd>
                </div>
              ))}
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
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-ungrd-surface px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40 dark:border-emerald-700"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar placa
          </button>
        </div>
      </div>
    );
  }

  if (selected && bySerial) {
    const serial = displayOpOf(selected);
    const p = selected.payload || {};
    const rows: { label: string; value: string }[] = [
      { label: "Referencia", value: String(p.referencia || "").trim() },
      { label: "Tipo maquinaria", value: String(p.tipo_maquinaria || "").trim() },
      { label: "Empresa", value: String(p.empresa || "").trim() },
      {
        label: "Convenio / contrato",
        value: String(p.no_convenio || "").trim(),
      },
      {
        label: "Estado máquina",
        value: String(p.estado_maquina || "").trim(),
      },
      { label: "Placa", value: String(p.placa || "").trim() },
    ];
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase dark:text-emerald-200">
              <Link2 className="h-3.5 w-3.5" />
              Serial del equipo
            </p>
            <p className="mt-1 text-lg font-extrabold break-all text-emerald-950 dark:text-emerald-50">
              {serial}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                    {row.label}
                  </dt>
                  <dd className="font-semibold break-all text-emerald-950 dark:text-emerald-50">
                    {row.value || "—"}
                  </dd>
                </div>
              ))}
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
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-ungrd-surface px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40 dark:border-emerald-700"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar serial
          </button>
        </div>
      </div>
    );
  }

  if (selected && (byConvenio || byContrato)) {
    const convenio = displayOpOf(selected);
    const p = selected.payload || {};
    const oc = String(p.no_orden_de_compra || "").trim();
    const contrato = String(
      p.no_convenio || selected.orden_de_proveeduria || convenio || "",
    ).trim();
    const estado = String(
      p.estado_convenio || p.estado || p.estado_maquina || "",
    ).trim();
    const entidad = String(p.entidad_receptora || "").trim();
    const depto = String(
      p.departamento || selected.departamento || "",
    ).trim();
    const muni = String(p.municipio || selected.municipio || "").trim();
    const objeto = String(p.objeto || selected.objeto || "").trim();
    const expectativa = String(
      p.cantidad_maquinaria_expectativa ??
        p.cantidad_maquinaria_espectativa ??
        "",
    ).trim();
    const entregada = String(p.cantidad_maquinaria_entregada ?? "").trim();

    if (byContrato) {
      const fromConvenio = Boolean(p._from_convenio);
      const empresaDet = String(p._lista_empresa || p.empresa || "").trim();
      const ubicDet = String(p._lista_ubicacion || "").trim();
      const equipos = Number(p.equipos_en_clave || 0);
      // Solo datos reales: marco de CONVENIOS, o hechos de DETALLE si no hay fila de convenio.
      const rows: { label: string; value: string }[] = fromConvenio
        ? [
            { label: "Departamento", value: depto },
            { label: "Municipio", value: muni === "-" ? "" : muni },
            { label: "Entidad receptora", value: entidad },
            { label: "Cantidad maquinaria expectativa", value: expectativa },
            { label: "Cantidad maquinaria entregada", value: entregada },
            { label: "Estado", value: estado },
          ]
        : [
            { label: "Empresa (detalle)", value: empresaDet },
            { label: "Ubicación (detalle)", value: ubicDet },
            {
              label: "Equipos en detalle",
              value: equipos > 0 ? String(equipos) : "",
            },
            { label: "Estado convenio (detalle)", value: estado },
          ];
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase dark:text-emerald-200">
                <Link2 className="h-3.5 w-3.5" />
                {fromConvenio ? "Convenio o proceso" : "Contrato / convenio (solo en Detalle)"}
              </p>
              <p className="mt-1 text-lg font-extrabold break-all text-emerald-950 dark:text-emerald-50">
                {contrato || oc || convenio}
              </p>
              {!fromConvenio ? (
                <p className="mt-1 text-xs font-medium text-emerald-900/80 dark:text-emerald-200/80">
                  Esta clave no está en la hoja CONVENIOS O PROCESOS del Excel; solo
                  hay equipos en DETALLE. No se inventan objeto ni cantidades.
                </p>
              ) : null}
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                      {row.label}
                    </dt>
                    <dd className="font-semibold break-all text-emerald-950 dark:text-emerald-50">
                      {row.value || "—"}
                    </dd>
                  </div>
                ))}
                {fromConvenio ? (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                      Objeto
                    </dt>
                    <dd className="whitespace-pre-wrap break-words font-semibold text-emerald-950 dark:text-emerald-50">
                      {objeto || "—"}
                    </dd>
                  </div>
                ) : null}
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
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-ungrd-surface px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40 dark:border-emerald-700"
            >
              <X className="h-3.5 w-3.5" />
              Cambiar filtro
            </button>
          </div>
        </div>
      );
    }

    const rows: { label: string; value: string }[] = [
      {
        label: "Entidad receptora",
        value: entidad,
      },
      {
        label: "Estado",
        value: estado,
      },
      {
        label: "Ubicación",
        value: [muni, depto].filter(Boolean).join(", "),
      },
      {
        label: "Valor total",
        value: formatOrdenValor(
          (p.valor_total as number | string | undefined) ?? selected.valor,
        ),
      },
    ];
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase dark:text-emerald-200">
              <Link2 className="h-3.5 w-3.5" />
              Nº convenio o proceso
            </p>
            <p className="mt-1 text-lg font-extrabold break-all text-emerald-950 dark:text-emerald-50">
              {convenio}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                    {row.label}
                  </dt>
                  <dd className="font-semibold break-all text-emerald-950 dark:text-emerald-50">
                    {row.value || "—"}
                  </dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Objeto
                </dt>
                <dd className="whitespace-pre-wrap break-words font-semibold text-emerald-950 dark:text-emerald-50">
                  {String(p.objeto || selected.objeto || "") || "—"}
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
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-ungrd-surface px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40 dark:border-emerald-700"
          >
            <X className="h-3.5 w-3.5" />
            Cambiar convenio
          </button>
        </div>
      </div>
    );
  }

  if (selected) {
    const shown = displayOpOf(selected);
    const isPago = selected.match_kind === "x_pago";
    const estado = String(
      selected.payload?.estado_actual || selected.payload?.estado || "",
    ).trim();
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-emerald-900 uppercase dark:text-emerald-200">
              <Link2 className="h-3.5 w-3.5" />
              {isPago
                ? "OP por pago (ligada al alta)"
                : "OP del registro inicial"}
            </p>
            <p className="mt-1 text-lg font-extrabold text-emerald-950 dark:text-emerald-50">
              {shown}
            </p>
            {isPago &&
            selected.orden_de_proveeduria &&
            selected.orden_de_proveeduria !== shown ? (
              <p className="mt-0.5 text-xs font-semibold text-emerald-800/80 dark:text-emerald-300/90">
                OP única: {selected.orden_de_proveeduria}
              </p>
            ) : null}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Proveedor
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {selected.proveedor || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  NIT
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {selected.nit || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Valor de la orden
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {formatOrdenValor(selected.valor)}
                </dd>
              </div>
              {estado ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                    Estado actual
                  </dt>
                  <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                    {estado}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Tipo de orden
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {selected.tipo_de_orden ||
                    String(selected.payload?.tipo_de_orden || "") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Ubicación
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {[selected.municipio, selected.departamento]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[10px] font-bold uppercase text-emerald-800/70 dark:text-emerald-300/80">
                  Objeto
                </dt>
                <dd className="whitespace-pre-wrap break-words font-semibold text-emerald-950 dark:text-emerald-50">
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
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-ungrd-surface px-3 py-1.5 text-xs font-bold text-ungrd-heading hover:border-ungrd-navy/40 dark:border-emerald-700"
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
        {byPlaca
          ? "Buscar placa de la maqueta"
          : bySerial
            ? "Buscar serial del equipo"
            : byContrato
              ? "Buscar orden de compra o contrato"
              : byConvenio
                ? "Buscar nº convenio o proceso"
                : "Buscar orden del registro inicial"}
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
              byPlaca
                ? "Ej. OZJ943… marca, municipio"
                : bySerial
                  ? "Serial, referencia, empresa, nº máquina…"
                  : byContrato
                    ? "Nº orden de compra o contrato de adquisición…"
                    : byConvenio
                      ? "Nº convenio, departamento, entidad…"
                      : expandPaymentOps
                        ? "OP única o OP x pago… proveedor, municipio, NIT"
                        : "Ej. GS-SMD-006… proveedor, municipio, NIT"
            }
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2.5 pr-3 pl-10 text-sm font-normal text-ungrd-text outline-none focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40"
            autoComplete="off"
          />
        </div>
      </label>
      <p className="text-xs text-ungrd-muted">
        {byPlaca
          ? "Escriba la placa y seleccione el carrotanque; no se reescribe el alta (B–J)."
          : bySerial
            ? "Seleccione el equipo del detalle; la identidad (serial) no se reescribe."
            : byContrato
              ? "Filtre por nº de convenio/contrato u orden de compra (claves de Detalle maquinaria)."
              : byConvenio
                ? "Seleccione el convenio; los eventos de bitácora se ligan a ese número."
                : expandPaymentOps
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
        <ul className="absolute z-20 mt-1 max-h-96 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
          {hits.map((h) => {
            const shown = displayOpOf(h);
            const isPago = h.match_kind === "x_pago";
            const rowKey = `${h.id}:${h.match_kind || "unica"}:${shown}`;
            const marca = String(h.payload?.marca || "").trim();
            return (
              <li key={rowKey}>
                <button
                  type="button"
                  className="w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 dark:border-slate-700/80 dark:hover:bg-slate-800"
                  onClick={() => {
                    onSelect(h);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-extrabold tracking-wide text-slate-900 dark:text-slate-50">
                      {shown}
                    </span>
                    {!byAsset && expandPaymentOps ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                          isPago
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                        }`}
                      >
                        {isPago ? "OP x pago" : "OP única"}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs font-medium text-slate-600 dark:text-slate-300">
                    {[
                      !byAsset &&
                      isPago &&
                      h.orden_de_proveeduria !== shown
                        ? `OP única: ${h.orden_de_proveeduria}`
                        : null,
                      byPlaca
                        ? marca || null
                        : bySerial
                          ? String(h.payload?.referencia || h.payload?.empresa || "").trim() ||
                            null
                          : byContrato
                            ? [
                                String(h.payload?.no_orden_de_compra || "").trim()
                                  ? `OC ${h.payload?.no_orden_de_compra}`
                                  : null,
                                String(
                                  h.payload?._lista_empresa ||
                                    h.payload?.empresa ||
                                    h.payload?.entidad_receptora ||
                                    "",
                                ).trim() || null,
                                Number(h.payload?.equipos_en_clave || 0) > 0
                                  ? `${h.payload?.equipos_en_clave} equipos`
                                  : null,
                                String(h.payload?._lista_ubicacion || "").trim() ||
                                  null,
                                String(h.objeto || h.payload?.objeto || "").trim() ||
                                  null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || null
                          : byConvenio
                            ? [
                                String(
                                  h.payload?.entidad_receptora || "",
                                ).trim() || null,
                                String(h.objeto || h.payload?.objeto || "").trim() ||
                                  null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || null
                            : h.proveedor,
                      byContrato ? null : h.municipio,
                      byContrato ? null : h.departamento,
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
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {byPlaca
            ? `No hay coincidencias con «${q.trim()}». Pruebe otra placa o municipio.`
            : bySerial
              ? `No hay coincidencias con «${q.trim()}». Pruebe otro serial, referencia o empresa.`
              : byContrato
                ? `No hay coincidencias con «${q.trim()}». Pruebe nº de orden de compra o contrato de adquisición.`
                : byConvenio
                  ? `No hay coincidencias con «${q.trim()}». Pruebe otro nº de convenio o departamento.`
                  : `No hay coincidencias con «${q.trim()}». Pruebe otro fragmento de OP (p. ej. GS-SMD) o el nombre del proveedor.`}
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

/** Identidad y atributos de maqueta que se heredan por placa (Carrotanques). */
export const PLACA_CONTEXT_KEYS = [
  "placa",
  "placa_ungrd",
  "clave_seguimiento",
  "clase",
  "marca",
  "modelo",
  "modelo_ref",
  "serial",
  "ano_compra",
  "capacidad_lt",
  "otras_categorizaciones",
  "clasificacion_propiedad",
  "ubicacion_actual",
  "departamento",
  "municipio",
  "region",
  "estado",
  "ente_receptor",
  "lt_suministrados",
  "personas_beneficiadas",
  "comunidades_beneficiadas",
] as const;

export type OrdenLookupBy = "orden" | "placa" | "serial" | "convenio" | "contrato";

export function inheritFromAlta(
  hit: OrdenLookupHit,
  fieldNames: string[],
  opts?: { byPlaca?: boolean; lookupBy?: OrdenLookupBy },
): Record<string, string> {
  const lookupBy: OrdenLookupBy =
    opts?.lookupBy || (opts?.byPlaca ? "placa" : "orden");
  const byAsset =
    lookupBy === "placa" ||
    lookupBy === "serial" ||
    lookupBy === "convenio" ||
    lookupBy === "contrato";
  const mainOp = hit.orden_de_proveeduria;
  const placa = String(
    hit.payload?.placa || (lookupBy === "placa" ? mainOp : "") || "",
  ).trim();
  const serial = String(
    hit.payload?.serial || (lookupBy === "serial" ? mainOp : "") || "",
  ).trim();
  const noConvenio = String(
    hit.payload?.no_convenio ||
      (lookupBy === "convenio" || lookupBy === "contrato" ? mainOp : "") ||
      "",
  ).trim();
  const noOrdenCompra = String(
    hit.payload?.no_orden_de_compra || "",
  ).trim();

  const assetKey =
    lookupBy === "placa"
      ? placa
      : lookupBy === "serial"
        ? serial
        : lookupBy === "convenio" || lookupBy === "contrato"
          ? noConvenio
          : "";

  const out: Record<string, string> = {
    orden_de_proveeduria: mainOp,
    clave_seguimiento: byAsset && assetKey ? assetKey : mainOp,
  };
  if (lookupBy === "placa" && placa) out.placa = placa;
  if (lookupBy === "serial" && serial) out.serial = serial;
  if (
    (lookupBy === "convenio" || lookupBy === "contrato") &&
    noConvenio
  ) {
    out.no_convenio = noConvenio;
  }
  if (lookupBy === "contrato" && noOrdenCompra) {
    out.no_orden_de_compra = noOrdenCompra;
  }

  const contextKeys =
    lookupBy === "placa"
      ? ([...PLACA_CONTEXT_KEYS] as string[])
      : ([...ALTA_CONTEXT_KEYS] as string[]);

  for (const key of contextKeys) {
    if (
      key === "orden_de_proveeduria" ||
      key === "clave_seguimiento" ||
      key === "orden_de_proveeduria_x_pago" ||
      key === "placa" ||
      key === "serial" ||
      key === "no_convenio"
    ) {
      continue;
    }
    if (!fieldNames.includes(key)) continue;
    const v = hit.payload[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      out[key] = String(v);
    }
  }

  // Cualquier otro campo del formulario presente en el payload (maqueta completa).
  // En convenio/contrato no heredar campos de evento (bitácora captura estado/fecha/comentario nuevos).
  if (byAsset) {
    const skipEventFields =
      lookupBy === "convenio" || lookupBy === "contrato"
        ? new Set([
            "estado",
            "fecha_de_estado",
            "comentario",
            "fecha",
            "observaciones",
          ])
        : null;
    for (const key of fieldNames) {
      if (key === "tipo_registro" || key === "capa" || out[key]) continue;
      if (skipEventFields?.has(key)) continue;
      const v = hit.payload[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        out[key] = String(v);
      }
    }
  }

  // Prefill hit summary fields even if only used for context
  if (!byAsset) {
    if (hit.proveedor) out.proveedor = hit.proveedor;
    if (hit.nit && fieldNames.includes("nit")) out.nit = hit.nit;
  }
  if (hit.departamento && fieldNames.includes("departamento") && !out.departamento) {
    out.departamento = hit.departamento;
  }
  if (hit.municipio && fieldNames.includes("municipio") && !out.municipio) {
    out.municipio = hit.municipio;
  }
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
