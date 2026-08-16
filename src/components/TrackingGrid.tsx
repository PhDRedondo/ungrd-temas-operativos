"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Table2,
} from "lucide-react";
import type { CaptureFormConfig, ThemeConfig } from "@/lib/themes";
import type { RecordRow } from "@/lib/records/types";
import { useAuth } from "@/lib/auth";
import { canWrite } from "@/lib/auth/roles";
import {
  AGUA_TABLAS_ACTUALIZABLES,
  normalizeAguaCapa,
} from "@/themes/agua-y-saneamiento/capture-forms";
import {
  CARRO_TABLAS_ACTUALIZABLES,
  normalizeCarroCapa,
} from "@/themes/carrotanques/capture-forms";

type VersionRow = {
  id: string;
  version: number;
  payload: Record<string, unknown>;
  changedFields: string[];
  reason: string;
  createdAt: string;
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: number;
};

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
  onChanged: () => void;
};

function capaOf(themeId: string, r: RecordRow): string {
  const raw = String(r.tipo_registro || r.capa || "");
  if (themeId === "carrotanques") return normalizeCarroCapa(raw);
  return normalizeAguaCapa(raw);
}

function keyOf(themeId: string, r: RecordRow): string {
  if (themeId === "carrotanques") {
    return String(r.placa || r.clave_seguimiento || "").trim();
  }
  return String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim();
}

function cellValue(row: RecordRow, name: string): string {
  const v = row[name];
  if (v === undefined || v === null) return "";
  return String(v);
}

export function TrackingGrid({ theme, records, onChanged }: Props) {
  const { role } = useAuth();
  const writable = canWrite(role || undefined);
  const carro = theme.id === "carrotanques";

  const trackingForms = useMemo(() => {
    const forms = theme.captureForms || [];
    const prefer = new Set(
      (carro
        ? CARRO_TABLAS_ACTUALIZABLES
        : AGUA_TABLAS_ACTUALIZABLES) as readonly string[],
    );
    const filtered = forms.filter(
      (f) => prefer.has(f.capa) || f.mode === "append",
    );
    return filtered.length
      ? filtered
      : forms.filter((f) => f.mode === "append");
  }, [theme.captureForms, carro]);

  const [formId, setFormId] = useState(trackingForms[0]?.id || "");
  const activeForm: CaptureFormConfig | undefined =
    trackingForms.find((f) => f.id === formId) || trackingForms[0];

  const [keyFilter, setKeyFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormId(trackingForms[0]?.id || "");
    setKeyFilter("");
  }, [theme.id, trackingForms]);

  const columns = useMemo(() => {
    if (!activeForm) return [] as string[];
    return activeForm.fieldNames.filter(
      (n) => n !== "tipo_registro" && n !== "capa" && n !== "marca",
    );
  }, [activeForm]);

  const fieldsByName = useMemo(
    () => new Map(theme.fields.map((f) => [f.name, f])),
    [theme.fields],
  );

  const rows = useMemo(() => {
    if (!activeForm) return [];
    const capa = activeForm.capa;
    const q = keyFilter.trim().toLowerCase();
    return records.filter((r) => {
      if (capaOf(theme.id, r) !== capa) return false;
      if (!q) return true;
      return keyOf(theme.id, r).toLowerCase().includes(q);
    });
  }, [records, activeForm, keyFilter, theme.id]);

  useEffect(() => {
    setDrafts({});
    setSelectedId(null);
    setVersions([]);
    setNewRow({});
  }, [formId]);

  async function loadVersions(recordId: string) {
    setVersionsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/themes/${theme.id}/records/${recordId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar historial");
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error historial");
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  function selectRow(id: string) {
    setSelectedId(id);
    void loadVersions(id);
  }

  function draftValue(row: RecordRow, name: string): string {
    const d = drafts[row.id];
    if (d && name in d) return d[name]!;
    return cellValue(row, name);
  }

  function setDraft(rowId: string, name: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [name]: value },
    }));
  }

  async function saveCell(row: RecordRow, name: string) {
    if (!writable || !activeForm) return;
    const next = draftValue(row, name);
    const prev = cellValue(row, name);
    if (next === prev) return;

    setBusyId(row.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/themes/${theme.id}/records/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: { [name]: next },
          reason: `edición celda ${name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMessage(
        `Guardado · v${data.version}${
          data.changedFields?.length
            ? ` · ${data.changedFields.join(", ")}`
            : ""
        }`,
      );
      setDrafts((prev) => {
        const copy = { ...prev };
        if (copy[row.id]) {
          const { [name]: _, ...rest } = copy[row.id]!;
          copy[row.id] = rest;
        }
        return copy;
      });
      onChanged();
      if (selectedId === row.id) void loadVersions(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setDraft(row.id, name, prev);
    } finally {
      setBusyId(null);
    }
  }

  async function restoreVersion(version: number) {
    if (!writable || !selectedId) return;
    if (
      !confirm(
        `¿Restaurar la versión ${version}? Se creará una versión nueva (no se borra el historial).`,
      )
    ) {
      return;
    }
    setBusyId(selectedId);
    setError(null);
    try {
      const res = await fetch(
        `/api/themes/${theme.id}/records/${selectedId}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al restaurar");
      setMessage(`Restaurado desde v${version} → ahora v${data.version}`);
      onChanged();
      void loadVersions(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function addRow() {
    if (!writable || !activeForm) return;
    const key = carro
      ? (newRow.placa || "").trim()
      : (newRow.orden_de_proveeduria || "").trim();
    if (!key) {
      setError(
        carro
          ? "Indique la placa para la fila nueva."
          : "Indique la orden de proveeduría para la fila nueva.",
      );
      return;
    }
    setBusyId("__new__");
    setError(null);
    try {
      const values: Record<string, string | number> = {};
      for (const name of activeForm.fieldNames) {
        const field = fieldsByName.get(name);
        const raw = newRow[name] || "";
        values[name] =
          field?.type === "number" ? Number(raw || 0) : raw;
      }
      values.tipo_registro = activeForm.capa;
      values.capa = activeForm.capa;
      if (carro) {
        values.placa = key;
        values.clave_seguimiento = key;
      } else {
        values.orden_de_proveeduria = key;
      }

      const res = await fetch(`/api/themes/${theme.id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: activeForm.id,
          mode: "append",
          values,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.errors?.[0]?.message || data.error || "Error al crear",
        );
      }
      setNewRow({});
      setMessage("Fila agregada al historial de la tabla.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  function renderInput(
    value: string,
    onChange: (v: string) => void,
    onCommit: () => void,
    fieldName: string,
    disabled?: boolean,
  ) {
    const field = fieldsByName.get(fieldName);
    if (field?.type === "select" && field.options?.length) {
      return (
        <select
          value={value}
          disabled={disabled || !writable}
          onChange={(e) => {
            onChange(e.target.value);
            // commit after state update via timeout
            const v = e.target.value;
            onChange(v);
            setTimeout(onCommit, 0);
          }}
          className="min-w-[10rem] w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-ungrd-border focus:border-ungrd-navy focus:bg-ungrd-input"
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    const type =
      field?.type === "number"
        ? "number"
        : field?.type === "date"
          ? "date"
          : "text";
    if (field?.type === "textarea") {
      return (
        <textarea
          value={value}
          disabled={disabled || !writable}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          className="min-h-[2rem] w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-ungrd-text outline-none hover:border-ungrd-border focus:border-ungrd-navy focus:bg-ungrd-input"
          rows={2}
        />
      );
    }
    return (
      <input
        type={type}
        value={value}
        disabled={disabled || !writable}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-[7rem] rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-ungrd-text outline-none hover:border-ungrd-border focus:border-ungrd-navy focus:bg-ungrd-input"
      />
    );
  }

  if (!trackingForms.length) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Este tema no tiene tablas de seguimiento configuradas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ungrd-navy/15 bg-ungrd-navy/[0.04] px-4 py-3 text-sm text-ungrd-muted">
        <p className="inline-flex items-center gap-2 font-extrabold text-ungrd-heading">
          <Table2 className="h-4 w-4 text-ungrd-navy" />
          Edición en tabla
        </p>
        <p className="mt-1">
          Edite una celda y, al salir, se guarda. Use Historial para ver cambios
          o restaurar. La fila vacía al final sirve para agregar un registro.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {trackingForms.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFormId(f.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold sm:text-sm ${
              activeForm?.id === f.id
                ? "theme-mark border-transparent"
                : "border-ungrd-border bg-ungrd-surface text-ungrd-heading hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--ungrd-border))]"
            }`}
          >
            {f.label.replace(/^\d+\s*·\s*/, "")}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-ungrd-heading">
          {carro ? "Filtrar placa" : "Filtrar orden de proveeduría"}
          <input
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            placeholder={carro ? "OZJ943…" : "GS-SMD-…"}
            className="ml-2 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-1.5 text-sm font-normal"
          />
        </label>
        <span className="text-xs text-ungrd-muted">
          {rows.length} filas · {activeForm?.capa}
        </span>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="ungrd-data-table overflow-auto rounded-xl border border-ungrd-border">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-ungrd-navy text-white">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 font-bold">#</th>
                {columns.map((name) => (
                  <th
                    key={name}
                    className="whitespace-nowrap px-2 py-2 font-bold"
                  >
                    {fieldsByName.get(name)?.label || name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => selectRow(row.id)}
                  className={`border-t border-ungrd-border ${
                    selectedId === row.id
                      ? "bg-ungrd-row-selected"
                      : idx % 2
                        ? "bg-ungrd-row-alt"
                        : "bg-ungrd-row"
                  } text-ungrd-text ${busyId === row.id ? "opacity-60" : ""}`}
                >
                  <td className="px-2 py-1 text-ungrd-muted">
                    {busyId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </td>
                  {columns.map((name) => (
                    <td key={name} className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                      {renderInput(
                        draftValue(row, name),
                        (v) => setDraft(row.id, name, v),
                        () => void saveCell(row, name),
                        name,
                        busyId === row.id,
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Nueva fila */}
              <tr className="border-t-2 border-dashed border-ungrd-navy/30 bg-ungrd-navy/[0.03]">
                <td className="px-2 py-1 text-ungrd-navy">
                  <Plus className="h-3.5 w-3.5" />
                </td>
                {columns.map((name) => (
                  <td key={name} className="px-1 py-0.5">
                    {renderInput(
                      newRow[name] || "",
                      (v) => setNewRow((p) => ({ ...p, [name]: v })),
                      () => undefined,
                      name,
                      busyId === "__new__",
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="flex items-center justify-between gap-2 border-t border-ungrd-border px-3 py-2">
            <p className="text-[11px] text-ungrd-muted">
              Clic en una fila para ver historial de versiones. Edite y pulse Tab
              / Enter o salga de la celda para guardar.
            </p>
            <button
              type="button"
              disabled={!writable || busyId === "__new__"}
              onClick={() => void addRow()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ungrd-yellow px-3 py-1.5 text-xs font-extrabold text-ungrd-navy-deep disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Agregar fila
            </button>
          </div>
        </div>

        <aside className="rounded-xl border border-ungrd-border bg-ungrd-surface p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
            <History className="h-3.5 w-3.5" />
            Historial / versiones
          </p>
          {!selectedId ? (
            <p className="mt-3 text-sm text-ungrd-muted">
              Seleccione una fila para ver su historial.
            </p>
          ) : versionsLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ungrd-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </p>
          ) : versions.length === 0 ? (
            <p className="mt-3 text-sm text-ungrd-muted">
              Aún no hay versiones. La primera edición creará v1 (estado
              anterior) y v2 (cambio).
            </p>
          ) : (
            <ul className="mt-3 max-h-[28rem] space-y-2 overflow-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-ungrd-border bg-ungrd-bg/50 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-ungrd-heading">
                      v{v.version}
                    </span>
                    <span className="text-[10px] text-ungrd-muted">
                      {new Date(v.createdAt).toLocaleString("es-CO")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-ungrd-muted">
                    {v.reason || "sin motivo"}
                  </p>
                  {v.changedFields?.length ? (
                    <p className="mt-1 text-[10px] text-ungrd-navy">
                      Campos: {v.changedFields.join(", ")}
                    </p>
                  ) : null}
                  {writable ? (
                    <button
                      type="button"
                      disabled={busyId === selectedId}
                      onClick={() => void restoreVersion(v.version)}
                      className="mt-2 inline-flex items-center gap-1 rounded border border-ungrd-border px-2 py-1 font-bold text-ungrd-heading hover:bg-ungrd-input disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
