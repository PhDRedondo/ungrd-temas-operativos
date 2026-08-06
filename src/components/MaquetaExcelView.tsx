"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  History,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import type { RecordRow } from "@/lib/records/types";
import { useAuth } from "@/lib/auth";
import { canWrite } from "@/lib/auth/roles";

import {
  AGUA_CAPAS_UI,
  isAguaCapaOficial,
  normalizeAguaCapa,
} from "@/themes/agua-y-saneamiento/capture-forms";

type ChangeMark = {
  versionCount: number;
  maxVersion: number;
  changedFields: string[];
};

type VersionRow = {
  id: string;
  version: number;
  payload: Record<string, unknown>;
  changedFields: string[];
  reason: string;
  createdAt: string;
};

type Props = {
  theme: ThemeConfig;
  records: RecordRow[];
  onChanged: () => void;
};

const HIDDEN = new Set(["tipo_registro", "capa", "clave_seguimiento"]);
const PAGE_SIZE = 40;

/** Columnas prioritarias (vista rápida; el resto con «Más columnas»). */
const PIN_LEFT = [
  "orden_de_proveeduria",
  "departamento",
  "municipio",
  "proveedor",
  "nit",
  "valor",
  "tipo_de_orden",
  "administracion",
  "nombre_orden",
  "responsable_apoyo_a_la_supervision",
  "tecnico_asignado",
  "abogado_asignado_r_tecnica",
  "financiero_asignado",
  "estado",
  "estado_actual",
  "dependencia",
];

function capaOf(r: RecordRow) {
  return normalizeAguaCapa(String(r.tipo_registro || r.capa || "")) || "Sin capa";
}

function opOf(r: RecordRow) {
  return String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim();
}

function cellStr(row: RecordRow, name: string) {
  const v = row[name];
  if (v === undefined || v === null) return "";
  return String(v);
}

export function MaquetaExcelView({ theme, records, onChanged }: Props) {
  const { role } = useAuth();
  const writable = canWrite(role || undefined);

  const [opFilter, setOpFilter] = useState("");
  const [opQuery, setOpQuery] = useState("");
  const [capaFilter, setCapaFilter] = useState<string>("Alta / orden");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [page, setPage] = useState(0);
  const [marks, setMarks] = useState<Record<string, ChangeMark>>({});
  const [marksReady, setMarksReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fieldsByName = useMemo(
    () => new Map(theme.fields.map((f) => [f.name, f])),
    [theme.fields],
  );

  const columns = useMemo(() => {
    const names = theme.fields
      .map((f) => f.name)
      .filter((n) => !HIDDEN.has(n));
    const pinned = PIN_LEFT.filter((n) => names.includes(n));
    if (!showAllColumns) return pinned;
    const rest = names.filter((n) => !pinned.includes(n));
    return [...pinned, ...rest];
  }, [theme.fields, showAllColumns]);

  const capas = useMemo(() => [...AGUA_CAPAS_UI], []);

  // Debounce búsqueda OP
  useEffect(() => {
    const t = setTimeout(() => {
      setOpQuery(opFilter.trim().toLowerCase());
      setPage(0);
    }, 200);
    return () => clearTimeout(t);
  }, [opFilter]);

  useEffect(() => {
    setPage(0);
  }, [capaFilter, onlyChanged, showAllColumns]);

  const loadMarks = useCallback(async () => {
    try {
      const res = await fetch(`/api/themes/${theme.id}/change-marks`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setMarks(data.marks || {});
      else setMarks({});
    } catch {
      setMarks({});
    } finally {
      setMarksReady(true);
    }
  }, [theme.id]);

  // Cargar / refrescar marcas (no bloquear tabla)
  useEffect(() => {
    setMarksReady(false);
    const id = window.setTimeout(() => void loadMarks(), 50);
    return () => window.clearTimeout(id);
  }, [loadMarks, records]);

  useEffect(() => {
    const onFocus = () => void loadMarks();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadMarks]);

  const rows = useMemo(() => {
    return records.filter((r) => {
      const capa = capaOf(r);
      if (!isAguaCapaOficial(capa) && capa !== "Sin capa") return false;
      if (capa === "Sin capa") return false;
      // Con búsqueda por OP: mostrar realidad completa (todas las capas de esa OP).
      if (opQuery) {
        if (!opOf(r).toLowerCase().includes(opQuery)) return false;
      } else if (capaFilter !== "__todas__" && capa !== capaFilter) {
        return false;
      }
      if (onlyChanged && marksReady && !hasChanges(marks[r.id])) {
        return false;
      }
      return true;
    });
  }, [records, capaFilter, opQuery, onlyChanged, marks, marksReady]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  async function loadVersions(recordId: string) {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/themes/${theme.id}/records/${recordId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error historial");
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  /** Solo filas con historial real (más de la foto inicial). */
  function hasChanges(mark?: ChangeMark) {
    return (mark?.maxVersion || 0) > 1 || (mark?.versionCount || 0) > 1;
  }

  function openHistory(row: RecordRow) {
    setSelectedId(row.id);
    setSelectedOp(opOf(row) || row.id.slice(0, 8));
    setHistoryOpen(true);
    void loadVersions(row.id);
  }

  function closeHistory() {
    setHistoryOpen(false);
    setSelectedId(null);
    setSelectedOp("");
    setVersions([]);
  }

  function draftValue(row: RecordRow, name: string) {
    const d = drafts[row.id];
    if (d && name in d) return d[name]!;
    return cellStr(row, name);
  }

  function setDraft(rowId: string, name: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] || {}), [name]: value },
    }));
  }

  async function saveCell(row: RecordRow, name: string, explicit?: string) {
    if (!writable) return;
    const next = explicit !== undefined ? explicit : draftValue(row, name);
    const prev = cellStr(row, name);
    if (next === prev) {
      setEditingCell(null);
      return;
    }

    setBusyId(row.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/themes/${theme.id}/records/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: { [name]: next },
          reason: `edición Excel · ${name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setMessage(`Guardado v${data.version} · ${name}`);
      setDrafts((prevDrafts) => {
        const copy = { ...prevDrafts };
        if (copy[row.id]) {
          const { [name]: _, ...rest } = copy[row.id]!;
          copy[row.id] = rest;
        }
        return copy;
      });
      onChanged();
      void loadMarks();
      if (selectedId === row.id) void loadVersions(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setDraft(row.id, name, prev);
    } finally {
      setBusyId(null);
      setEditingCell(null);
    }
  }

  async function restoreVersion(version: number) {
    if (!writable || !selectedId) return;
    if (
      !confirm(
        `¿Volver a la versión ${version}? Se crea una versión nueva; el historial se conserva completo (nada se elimina).`,
      )
    ) {
      return;
    }
    setBusyId(selectedId);
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
      if (!res.ok) throw new Error(data.error || "Error");
      setMessage(`Restaurado desde v${version} → v${data.version}`);
      onChanged();
      void loadMarks();
      void loadVersions(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  function renderCell(row: RecordRow, name: string, changed: boolean) {
    const cellKey = `${row.id}:${name}`;
    const value = draftValue(row, name);
    const field = fieldsByName.get(name);
    const editing = editingCell === cellKey;

    if (!editing) {
      return (
        <button
          type="button"
          title={writable ? "Clic para editar" : value}
          disabled={busyId === row.id}
          onClick={(e) => {
            e.stopPropagation();
            if (!writable) return;
            setEditingCell(cellKey);
          }}
          className={`block w-full max-w-[14rem] truncate px-1.5 py-1 text-left ${
            writable ? "hover:bg-white hover:ring-1 hover:ring-ungrd-navy/30" : ""
          }`}
        >
          {changed ? (
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5 text-amber-700" />
          ) : null}
          {value || <span className="text-ungrd-muted">—</span>}
        </button>
      );
    }

    if (field?.type === "select" && field.options?.length) {
      return (
        <select
          autoFocus
          value={value}
          disabled={!writable || busyId === row.id}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(row.id, name, v);
            void saveCell(row, name, v);
          }}
          onBlur={() => setEditingCell(null)}
          className="w-full rounded border border-ungrd-navy bg-white px-1 py-1 outline-none"
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

    return (
      <input
        autoFocus
        type={
          field?.type === "number"
            ? "number"
            : field?.type === "date"
              ? "date"
              : "text"
        }
        value={value}
        disabled={!writable || busyId === row.id}
        onChange={(e) => setDraft(row.id, name, e.target.value)}
        onBlur={() => void saveCell(row, name)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(row.id, name, cellStr(row, name));
            setEditingCell(null);
          }
        }}
        className="w-full min-w-[7rem] rounded border border-ungrd-navy bg-white px-1.5 py-1 outline-none"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-ungrd-navy/20 bg-gradient-to-r from-ungrd-navy/[0.06] to-ungrd-yellow/10 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
          <Table2 className="h-4 w-4 text-ungrd-navy" />
          Base completa · vista Excel
        </p>
        <p className="mt-1 text-sm text-ungrd-muted">
          Vista rápida por capa (paginada). Clic en una celda para editar. Si
          hay cambios verá un botón <span className="font-bold">vN</span> +
          historial: pulse ahí para abrir la tablita.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-ungrd-heading">
          <span className="mb-1 flex items-center gap-1 text-xs text-ungrd-muted">
            <Search className="h-3 w-3" /> Buscar OP
          </span>
          <input
            value={opFilter}
            onChange={(e) => setOpFilter(e.target.value)}
            placeholder="GS-SMD-…"
            className="rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-ungrd-heading">
          <span className="mb-1 block text-xs text-ungrd-muted">Capa / tabla</span>
          <select
            value={capaFilter}
            onChange={(e) => setCapaFilter(e.target.value)}
            className="rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal"
          >
            <option value="__todas__">Todas (puede ir lento)</option>
            {capas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-ungrd-heading">
          <input
            type="checkbox"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
          />
          Solo con versiones
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-ungrd-heading">
          <input
            type="checkbox"
            checked={showAllColumns}
            onChange={(e) => setShowAllColumns(e.target.checked)}
          />
          Todas las columnas
        </label>
        <span className="pb-2 text-xs text-ungrd-muted">
          {rows.length} filas · {columns.length} cols · pág. {safePage + 1}/
          {pageCount}
          {opQuery
            ? " · filtro OP: todas las capas de esa orden"
            : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-lg border border-ungrd-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          className="rounded-lg border border-ungrd-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
        >
          Siguiente →
        </button>
        <span className="text-xs text-ungrd-muted">
          Mostrando {pageRows.length} de {rows.length} (máx. {PAGE_SIZE}/página)
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

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-ungrd-border bg-white shadow-sm">
          <table className="min-w-max border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-ungrd-navy text-white">
                <th className="sticky left-0 z-30 bg-ungrd-navy px-2 py-2 font-bold">
                  #
                </th>
                <th className="sticky left-8 z-30 bg-ungrd-navy px-2 py-2 font-bold">
                  Capa
                </th>
                <th className="sticky left-[7.5rem] z-30 bg-ungrd-navy px-2 py-2 font-bold">
                  Ver.
                </th>
                {columns.map((name) => (
                  <th
                    key={name}
                    className="whitespace-nowrap px-2 py-2 font-bold"
                    title={name}
                  >
                    {fieldsByName.get(name)?.label || name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => {
                const mark = marks[row.id];
                const hasHist = hasChanges(mark);
                const selected = selectedId === row.id;
                const absIdx = safePage * PAGE_SIZE + idx + 1;
                const rowBg = selected
                  ? "bg-amber-50"
                  : idx % 2
                    ? "bg-slate-50"
                    : "bg-white";
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-200 ${rowBg} hover:bg-ungrd-yellow/15`}
                  >
                    <td
                      className={`sticky left-0 z-20 px-2 py-1 text-ungrd-muted ${rowBg}`}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        absIdx
                      )}
                    </td>
                    <td
                      className={`sticky left-8 z-20 max-w-[6.5rem] truncate px-2 py-1 font-semibold text-ungrd-navy ${rowBg}`}
                      title={capaOf(row)}
                    >
                      {capaOf(row)}
                    </td>
                    <td
                      className={`sticky left-[7.5rem] z-20 px-1 py-1 ${rowBg}`}
                    >
                      {hasHist ? (
                        <button
                          type="button"
                          title="Ver historial de cambios (clic)"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openHistory(row);
                          }}
                          className={`relative z-40 inline-flex items-center gap-1 rounded-md border px-1.5 py-1 ${
                            selected && historyOpen
                              ? "border-ungrd-navy bg-ungrd-navy text-white"
                              : "border-amber-300 bg-amber-100 text-amber-950 hover:border-ungrd-navy hover:bg-ungrd-navy hover:text-white"
                          }`}
                        >
                          <span className="text-[10px] font-extrabold">
                            v{mark!.maxVersion}
                          </span>
                          <History className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      ) : (
                        <span className="text-ungrd-muted" title="Sin cambios">
                          —
                        </span>
                      )}
                    </td>
                    {columns.map((name) => {
                      const changed = mark?.changedFields?.includes(name);
                      return (
                        <td
                          key={name}
                          className={`relative min-w-[7rem] px-0.5 py-0.5 ${
                            changed ? "bg-amber-100/80" : ""
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderCell(row, name, Boolean(changed))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    className="px-4 py-8 text-center text-sm text-ungrd-muted"
                  >
                    No hay filas con estos filtros. Pruebe otra capa o quite el
                    filtro de OP.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

      {historyOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Historial de cambios"
          onClick={closeHistory}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ungrd-border bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ungrd-border bg-ungrd-navy px-4 py-3 text-white">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <History className="h-4 w-4" />
                  Historial de cambios
                </p>
                <p className="mt-0.5 text-xs text-white/80">
                  OP · {selectedOp} · del más reciente al más viejo. Volver crea
                  una versión nueva (nada se elimina).
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistory}
                className="rounded p-1 hover:bg-white/15"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto p-3">
              {versionsLoading ? (
                <p className="flex items-center gap-2 px-2 py-8 text-sm text-ungrd-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando
                  historial…
                </p>
              ) : versions.length === 0 ? (
                <p className="px-2 py-8 text-sm text-ungrd-muted">
                  Esta fila aún no tiene versiones.
                </p>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ungrd-border bg-slate-50 text-ungrd-heading">
                      <th className="px-2 py-2 font-bold">Ver.</th>
                      <th className="px-2 py-2 font-bold">Fecha</th>
                      <th className="px-2 py-2 font-bold">Motivo / campos</th>
                      <th className="px-2 py-2 font-bold">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v, i) => {
                      const isCurrent = i === 0;
                      return (
                        <tr
                          key={v.id}
                          className={`border-b border-slate-200 ${
                            isCurrent ? "bg-emerald-100" : "bg-white"
                          }`}
                        >
                          <td className="whitespace-nowrap px-2 py-2.5 font-extrabold text-ungrd-heading">
                            v{v.version}
                            {isCurrent ? (
                              <span className="ml-1 rounded bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                actual
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-ungrd-muted">
                            {new Date(v.createdAt).toLocaleString("es-CO")}
                          </td>
                          <td className="px-2 py-2.5">
                            <p className="font-semibold text-ungrd-heading">
                              {v.reason || "—"}
                            </p>
                            {v.changedFields?.length ? (
                              <p className="mt-0.5 text-[11px] text-amber-800">
                                {v.changedFields.join(", ")}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-ungrd-muted">
                                (foto inicial / sin cambios)
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            {writable && !isCurrent ? (
                              <button
                                type="button"
                                disabled={busyId === selectedId}
                                title="Vuelve a este estado; se crea una versión nueva"
                                onClick={() => void restoreVersion(v.version)}
                                className="inline-flex items-center gap-1 rounded-lg border border-ungrd-navy bg-ungrd-navy px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-ungrd-navy-deep disabled:opacity-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Volver a esta
                              </button>
                            ) : isCurrent ? (
                              <span className="text-[11px] font-bold text-emerald-800">
                                en uso
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
