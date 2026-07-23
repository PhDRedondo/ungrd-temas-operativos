"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import type { RecordRow } from "@/lib/records/types";
import { DEPARTMENTS } from "@/lib/geo";
import { useAuth } from "@/lib/auth";
import { canWrite } from "@/lib/auth/roles";
import { groupCaptureFields, isSourceTheme } from "@/lib/analytics/decision";

type Props = {
  theme: ThemeConfig;
  onSaved: () => void;
};

type UploadError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

export function CapturePanel({ theme, onSaved }: Props) {
  const { role } = useAuth();
  const writable = canWrite(role || undefined);
  const [mode, setMode] = useState<"form" | "excel">("form");
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecordRow[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [busy, setBusy] = useState(false);

  const department = form.departamento || "";
  const municipalities = useMemo(() => {
    return (
      DEPARTMENTS.find((d) => d.name === department)?.municipalities.map(
        (m) => m.name,
      ) || []
    );
  }, [department]);

  const fieldSections = useMemo(() => {
    if (!isSourceTheme(theme.id)) {
      return [
        {
          id: "todos",
          title: "Datos del registro",
          names: theme.fields.map((f) => f.name),
        },
      ];
    }
    return groupCaptureFields(theme.fields);
  }, [theme]);

  const fieldsByName = useMemo(() => {
    return new Map(theme.fields.map((f) => [f.name, f]));
  }, [theme.fields]);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function renderField(fieldName: string) {
    const field = fieldsByName.get(fieldName);
    if (!field) return null;

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
            disabled={!writable || busy}
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
        {field.required ? (
          <span className="ml-1 text-ungrd-danger" aria-hidden>
            *
          </span>
        ) : null}
        {field.type === "select" ? (
          <select
            value={form[field.name] || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={common}
            required={field.required}
            disabled={!writable || busy}
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
            disabled={!writable || busy}
          />
        ) : (
          <input
            type={field.type}
            value={form[field.name] || ""}
            onChange={(e) => updateField(field.name, e.target.value)}
            className={common}
            required={field.required}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            disabled={!writable || busy}
          />
        )}
      </label>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!writable) {
      setError("Su rol no permite captura (requiere captura o admin).");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const values: Record<string, string | number> = {};
      for (const field of theme.fields) {
        const raw = form[field.name] || "";
        values[field.name] =
          field.type === "number" ? Number(raw || 0) : raw;
      }
      const res = await fetch(`/api/themes/${theme.id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          data.errors?.[0]?.message || data.error || "Error al guardar";
        setError(detail);
        return;
      }
      setForm({});
      setMessage("Registro guardado en PostgreSQL.");
      onSaved();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const res = await fetch(`/api/themes/${theme.id}/template`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo descargar la plantilla");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla_${theme.id}_v${theme.schemaVersion ?? 1}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error al descargar la plantilla.");
    }
  }

  async function onFile(file: File | null) {
    setError(null);
    setMessage(null);
    setPreview([]);
    setUploadErrors([]);
    if (!file) return;
    if (!writable) {
      setError("Su rol no permite carga masiva.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/themes/${theme.id}/uploads`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error en la carga");
        return;
      }
      setPreview((data.preview as RecordRow[]) || []);
      setUploadErrors((data.errors as UploadError[]) || []);
      if (data.async) {
        setMessage(
          `Carga encolada (${data.queued} filas). Vea progreso en la pestaña Cargas Excel / bandeja.`,
        );
      } else {
        setMessage(
          `Carga ${data.uploadId}: ${data.accepted} aceptados, ${data.rejected} rechazados, ${data.duplicates ?? 0} duplicados omitidos.`,
        );
      }
      if (data.accepted > 0 || data.async) onSaved();
    } catch {
      setError("No se pudo subir el archivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" id="tour-captura">
      {!writable && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Modo lectura: su rol <strong>{role}</strong> no puede crear registros.
          Use un usuario con rol <strong>captura</strong> o{" "}
          <strong>admin</strong>.
        </p>
      )}

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
        <form onSubmit={onSubmit} className="space-y-4">
          {isSourceTheme(theme.id) ? (
            <p className="rounded-xl border border-ungrd-navy/15 bg-ungrd-navy/[0.04] px-4 py-3 text-sm text-ungrd-muted">
              Formulario organizado por capas de la base oficial (seguimiento,
              ubicación, financiero y detalle operativo). Los campos coinciden
              con la plantilla Excel v{theme.schemaVersion ?? 1}.
            </p>
          ) : null}
          {fieldSections.map((section) => (
            <fieldset
              key={section.id}
              className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5"
            >
              <legend className="px-1 text-xs font-extrabold tracking-[0.16em] text-ungrd-navy uppercase">
                {section.title}
              </legend>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {section.names.map((name) => renderField(name))}
              </div>
            </fieldset>
          ))}
          <div>
            <button
              type="submit"
              disabled={!writable || busy}
              className="rounded-lg bg-ungrd-yellow px-5 py-2.5 text-sm font-extrabold text-ungrd-navy-deep transition hover:bg-ungrd-yellow-soft disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar registro"}
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
              Descargar plantilla (ExcelJS)
            </button>
            <label
              className={`inline-flex items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white hover:bg-ungrd-navy-mid ${
                !writable || busy
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <Upload className="h-4 w-4" />
              {busy ? "Procesando…" : "Subir Excel"}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={!writable || busy}
                onChange={(e) => onFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <p className="text-sm text-ungrd-muted">
            Plantilla con DIVIPOLA oficial (datos.gov.co), listas desplegables,
            hoja <code>_meta</code> y validación Zod. Filas inválidas se
            rechazan; duplicados se omiten; cargas ≥500 filas van en cola
            asíncrona.
          </p>
          {uploadErrors.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              <p className="mb-2 font-bold">
                Errores de validación ({uploadErrors.length})
              </p>
              <ul className="space-y-1">
                {uploadErrors.slice(0, 40).map((err, i) => (
                  <li key={`${err.row}-${err.field}-${i}`}>
                    Fila {err.row} · {err.field}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
