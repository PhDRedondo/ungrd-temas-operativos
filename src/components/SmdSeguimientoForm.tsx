"use client";

import { useMemo, useState } from "react";
import { formatCop, type RecordRow } from "@/lib/records/types";
import { parseCupoMoney } from "@/themes/ejecucion-financiera/corte-cupo";
import { modalidadDeLinea } from "@/themes/ejecucion-financiera/modalidad";
import {
  SEGUIMIENTO_HOJAS,
  SEGUIMIENTO_HOJA_KIND,
  isSeguimientoHojaRecord,
  seguimientoClave,
  seguimientoHojaById,
  type SeguimientoField,
} from "@/themes/ejecucion-financiera/seguimiento-hojas";

type Props = {
  records: RecordRow[];
  onSaved: () => void;
};

function fieldText(row: RecordRow, name: string): string {
  const v = row[name];
  return v == null ? "" : String(v);
}

export function SmdSeguimientoForm({ records, onSaved }: Props) {
  const [hojaId, setHojaId] = useState(SEGUIMIENTO_HOJAS[0]!.id);
  const hoja = seguimientoHojaById(hojaId) ?? SEGUIMIENTO_HOJAS[0]!;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const saved = useMemo(
    () =>
      records.filter(
        (r) => isSeguimientoHojaRecord(r) && String(r.hoja_id ?? "") === hoja.id,
      ),
    [records, hoja.id],
  );

  function setField(name: string, value: string) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const missing = hoja.fields.filter(
        (f) => f.required && !String(draft[f.name] ?? "").trim(),
      );
      if (missing.length) {
        throw new Error(`Falta ${missing.map((f) => f.label).join(", ")}.`);
      }
      const values: Record<string, unknown> = {
        _kind: SEGUIMIENTO_HOJA_KIND,
        tipo_registro: SEGUIMIENTO_HOJA_KIND,
        capa: SEGUIMIENTO_HOJA_KIND,
        hoja_id: hoja.id,
        pestana: hoja.pestana,
        resolucion_hoja: hoja.resolucion,
        departamento: "SIN DEPARTAMENTO",
        municipio: "SIN MUNICIPIO",
        fecha: new Date().toISOString().slice(0, 10),
        estado: hoja.pestana,
      };
      let valor = 0;
      for (const field of hoja.fields) {
        const raw = draft[field.name] ?? "";
        if (field.type === "money") {
          const n = parseCupoMoney(raw);
          values[field.name] = n;
          if (field.name === "valor_asignado") valor = n;
        } else {
          values[field.name] = raw.trim();
        }
      }
      const linea = String(values.linea ?? values.detalle ?? "");
      const detalle = String(values.detalle ?? "");
      values.modalidad = modalidadDeLinea(linea);
      const clave = seguimientoClave(hoja.id, linea, detalle);
      values.no_cdp = clave;
      values.clave_seguimiento = clave;
      values.valor = valor;
      const res = await fetch("/api/themes/ejecucion-financiera/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "upsert", values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la línea");
      setDraft({});
      setMsg(`Línea guardada en ${hoja.pestana}. El acumulado Fidusap no cambia.`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 shadow-sm">
      <h2 className="text-base font-extrabold text-ungrd-heading">
        Seguimiento por resolución
      </h2>
      <p className="mt-1 text-sm text-ungrd-muted">
        Un formulario por pestaña del libro de seguimiento. Estos registros no
        entran al acumulado de CDP de Fidusap.
      </p>
      <div className="mt-3 flex gap-2 overflow-auto pb-1">
        {SEGUIMIENTO_HOJAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setHojaId(item.id);
              setDraft({});
              setMsg(null);
              setErr(null);
            }}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-extrabold ${
              item.id === hoja.id
                ? "bg-ungrd-navy text-white"
                : "border border-ungrd-border bg-white text-ungrd-navy"
            }`}
          >
            {item.pestana}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-ungrd-navy">
        {hoja.titulo}
        {hoja.resolucion ? ` · Resolución ${hoja.resolucion}` : ""}
      </p>
      {draft.linea ? (
        <p className="mt-1 text-xs text-ungrd-muted">
          Modalidad de esta línea: {modalidadDeLinea(draft.linea) || "sin tipificar todavía"}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {hoja.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={draft[field.name] ?? ""}
            onChange={(value) => setField(field.name, value)}
          />
        ))}
      </div>
      {err ? <p className="mt-2 text-sm text-ungrd-danger">{err}</p> : null}
      {msg ? <p className="mt-2 text-sm text-emerald-800">{msg}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-3 rounded-lg bg-ungrd-navy px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {busy ? "Guardando…" : `Guardar línea en ${hoja.pestana}`}
      </button>
      <div className="mt-4 overflow-auto rounded-xl border border-ungrd-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-[10px] font-bold tracking-wide text-ungrd-navy uppercase">
            <tr>
              {hoja.fields.map((field) => (
                <th key={field.name} className="px-3 py-2">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {saved.length === 0 ? (
              <tr>
                <td
                  colSpan={hoja.fields.length}
                  className="px-3 py-4 text-ungrd-muted"
                >
                  Esta pestaña todavía no tiene líneas guardadas.
                </td>
              </tr>
            ) : (
              saved.map((row) => (
                <tr key={row.id} className="border-t border-ungrd-border">
                  {hoja.fields.map((field) => (
                    <td key={field.name} className="px-3 py-2 align-top">
                      {field.type === "money"
                        ? formatCop(Number(row[field.name]) || 0)
                        : fieldText(row, field.name)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SeguimientoField;
  value: string;
  onChange: (value: string) => void;
}) {
  const wide = field.type === "textarea";
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold text-ungrd-navy">
        {field.label}
        {field.required ? " *" : ""}
      </span>
      {field.type === "textarea" ? (
        <textarea
          rows={2}
          className="w-full rounded-md border border-ungrd-border px-2 py-1.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          inputMode={field.type === "money" ? "decimal" : "text"}
          className="h-9 w-full rounded-md border border-ungrd-border px-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
