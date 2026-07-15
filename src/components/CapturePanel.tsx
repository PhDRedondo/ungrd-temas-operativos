"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type { ThemeConfig } from "@/lib/themes";
import { addRecords, type RecordRow } from "@/lib/data";
import { DEPARTMENTS } from "@/lib/geo";

type Props = {
  theme: ThemeConfig;
  onSaved: () => void;
};

export function CapturePanel({ theme, onSaved }: Props) {
  const [mode, setMode] = useState<"form" | "excel">("form");
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecordRow[]>([]);

  const department = form.departamento || "";
  const municipalities = useMemo(() => {
    return (
      DEPARTMENTS.find((d) => d.name === department)?.municipalities.map(
        (m) => m.name,
      ) || []
    );
  }, [department]);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    for (const field of theme.fields) {
      if (field.required && !form[field.name]?.trim()) {
        setError(`Complete el campo: ${field.label}`);
        return;
      }
    }
    const row: RecordRow = {
      id: `${theme.id}-${Date.now()}`,
      departamento: form.departamento || "",
      municipio: form.municipio || "",
      fecha: form.fecha || new Date().toISOString().slice(0, 10),
      estado: form.estado || "Programado",
      valor: Number(form.valor || form.cantidad || form.beneficiarios || 0),
      ...Object.fromEntries(
        theme.fields.map((f) => [
          f.name,
          f.type === "number" ? Number(form[f.name] || 0) : form[f.name] || "",
        ]),
      ),
    };
    addRecords(theme.id, [row]);
    setForm({});
    setMessage("Registro guardado correctamente.");
    onSaved();
  }

  function downloadTemplate() {
    const headers = theme.fields.map((f) => f.name);
    const sample = theme.fields.map((f) => {
      if (f.type === "select") return f.options?.[0] || "";
      if (f.type === "number") return 100;
      if (f.type === "date") return "2026-07-15";
      return `Ejemplo ${f.label}`;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, theme.shortName.slice(0, 28));
    XLSX.writeFile(wb, `plantilla_${theme.id}.xlsx`);
  }

  async function onFile(file: File | null) {
    setError(null);
    setMessage(null);
    setPreview([]);
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, {
      defval: "",
    });
    if (!rows.length) {
      setError("El archivo no contiene filas.");
      return;
    }
    const mapped: RecordRow[] = rows.map((raw, idx) => {
      const normalized: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(raw)) {
        normalized[String(k).trim()] =
          typeof v === "number" ? v : String(v ?? "").trim();
      }
      return {
        id: `${theme.id}-xls-${Date.now()}-${idx}`,
        departamento: String(normalized.departamento || ""),
        municipio: String(normalized.municipio || ""),
        fecha: String(normalized.fecha || new Date().toISOString().slice(0, 10)),
        estado: String(normalized.estado || "Programado"),
        valor: Number(normalized.valor || normalized.cantidad || 0),
        ...normalized,
      };
    });
    setPreview(mapped.slice(0, 8));
    addRecords(theme.id, mapped);
    setMessage(`${mapped.length} registros cargados desde Excel.`);
    onSaved();
  }

  return (
    <div className="space-y-5" id="tour-captura">
      <div className="inline-flex rounded-xl border border-ungrd-border bg-ungrd-surface p-1">
        <button
          type="button"
          onClick={() => setMode("form")}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            mode === "form"
              ? "bg-ungrd-navy text-white"
              : "text-ungrd-muted hover:text-ungrd-heading"
          }`}
        >
          Carga individual
        </button>
        <button
          type="button"
          onClick={() => setMode("excel")}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            mode === "excel"
              ? "bg-ungrd-navy text-white"
              : "text-ungrd-muted hover:text-ungrd-heading"
          }`}
        >
          Carga masiva (Excel)
        </button>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-ungrd-success">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {mode === "form" ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-2xl border border-ungrd-border bg-ungrd-surface p-5 md:grid-cols-2"
        >
          {theme.fields.map((field) => {
            if (field.name === "municipio" && municipalities.length) {
              return (
                <label
                  key={field.name}
                  className="block text-sm font-semibold text-ungrd-heading"
                >
                  {field.label}
                  <select
                    value={form.municipio || ""}
                    onChange={(e) => updateField("municipio", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm font-normal text-ungrd-text outline-none focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40"
                    required={field.required}
                  >
                    <option value="">Seleccione…</option>
                    {municipalities.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            const common =
              "mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm font-normal text-ungrd-text outline-none focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40";

            return (
              <label
                key={field.name}
                className={`block text-sm font-semibold text-ungrd-heading ${
                  field.type === "textarea" ? "md:col-span-2" : ""
                }`}
              >
                {field.label}
                {field.type === "select" ? (
                  <select
                    value={form[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    className={common}
                    required={field.required}
                  >
                    <option value="">Seleccione…</option>
                    {field.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={form[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    className={`${common} min-h-24`}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={form[field.name] || ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    className={common}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            );
          })}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-ungrd-yellow px-5 py-2.5 text-sm font-extrabold text-ungrd-navy-deep transition hover:bg-ungrd-yellow-soft"
            >
              Guardar registro
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-ungrd-border bg-ungrd-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-ungrd-border px-4 py-2.5 text-sm font-bold text-ungrd-heading hover:bg-ungrd-bg"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Descargar plantilla
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-ungrd-navy-mid">
              <Upload className="h-4 w-4" />
              Subir Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <p className="text-sm text-ungrd-muted">
            Use la plantilla con las columnas del tema. Al cargar, los registros
            se incorporan de inmediato a la analítica.
          </p>
          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-ungrd-border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-ungrd-bg text-ungrd-heading">
                  <tr>
                    {Object.keys(preview[0]!)
                      .slice(0, 6)
                      .map((k) => (
                        <th key={k} className="px-3 py-2 font-bold">
                          {k}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.id} className="border-t border-ungrd-border">
                      {Object.values(row)
                        .slice(0, 6)
                        .map((v, i) => (
                          <td key={i} className="px-3 py-2 text-ungrd-muted">
                            {String(v)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
