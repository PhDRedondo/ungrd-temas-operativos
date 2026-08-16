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
import { displayCapaLabel } from "@/lib/capa-display";

import {
  AGUA_CAPAS_UI,
  isAguaCapaOficial,
  normalizeAguaCapa,
} from "@/themes/agua-y-saneamiento/capture-forms";
import {
  CARRO_CAPAS,
  normalizeCarroCapa,
} from "@/themes/carrotanques/capture-forms";
import {
  BMAQ_CAPAS,
  normalizeBmaqCapa,
} from "@/themes/banco-de-maquinaria/capture-forms";
import {
  PUENTES_CAPAS,
  normalizePuenteCapa,
} from "@/themes/puentes/capture-forms";
import {
  SUBSIDIOS_CAPAS,
  normalizeSubsidiosCapa,
} from "@/themes/subsidios-de-arriendos/capture-forms";

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

/** Columnas prioritarias Agua (vista rápida). */
const PIN_LEFT_AGUA = [
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

/** Columnas prioritarias Carrotanques (maqueta M–Z + identidad). */
const PIN_LEFT_CARRO = [
  "placa",
  "placa_ungrd",
  "marca",
  "clase",
  "modelo_ref",
  "capacidad_lt",
  "otras_categorizaciones",
  "clasificacion_propiedad",
  "ubicacion_actual",
  "departamento",
  "municipio",
  "region",
  "lt_suministrados",
  "per_benef",
  "com_benef",
  "fecha_inicio_estado_actual",
  "fech_fin_estado_actual",
  "fecha_desde_ultm_estado",
  "entidad_receptora",
  "ente_receptor",
  "estado",
  "situacion_de_prestamo",
  "observaciones",
];

/** Columnas prioritarias Banco de Maquinaria. */
const PIN_LEFT_BMAQ = [
  "no_convenio",
  "serial",
  "no_maquina",
  "empresa",
  "entidad_receptora",
  "tipo_maquinaria",
  "departamento",
  "municipio",
  "no_orden_de_compra",
  "referencia",
  "estado",
  "estado_maquina",
  "estado_convenio",
  "cantidad_maquinaria_expectativa",
  "cantidad_maquinaria_entregada",
  "objeto",
  "fecha_de_estado",
  "comentario",
  "observaciones",
];

/** Columnas prioritarias Puentes. */
const PIN_LEFT_PUENTES = [
  "id_puente",
  "contrato_convenio",
  "clave_proceso",
  "contrato",
  "departamento",
  "municipio",
  "estado",
  "estado_puente",
  "objeto",
  "valor",
  "longitud_m",
  "ancho_m",
  "fecha",
  "observaciones",
];

const PIN_LEFT_SUBSIDIOS = [
  "uuid",
  "numero_envio",
  "n_orden",
  "departamento",
  "municipio",
  "estado",
  "nombres_arrendatario",
  "apellidos_arrendatario",
  "no_contrato",
  "valor_total_pagado",
  "fecha_inicio",
  "_archivo_fuente",
];

type ThemeExcelProfile = {
  capas: readonly string[];
  defaultCapa: string;
  pinLeft: string[];
  searchLabel: string;
  searchPlaceholder: string;
  helpText: string;
  filterHint: string;
  emptyHint: string;
  normalizeCapa: (raw: string) => string;
  isOfficial: (capa: string) => boolean;
  keyOf: (r: RecordRow) => string;
};

function profileFor(themeId: string): ThemeExcelProfile {
  if (themeId === "carrotanques") {
    return {
      capas: CARRO_CAPAS,
      defaultCapa: "Maqueta / inventario",
      pinLeft: PIN_LEFT_CARRO,
      searchLabel: "Buscar placa",
      searchPlaceholder: "OZJ943…",
      helpText:
        "Busque por placa. Clic en una celda para editar; el botón de versión abre el historial.",
      filterHint: " · filtro placa: todas las capas de esa placa",
      emptyHint:
        " (Maqueta / Bitácora / Suministro) o quite el filtro de placa.",
      normalizeCapa: (raw) => normalizeCarroCapa(raw) || "Sin capa",
      isOfficial: (capa) => (CARRO_CAPAS as readonly string[]).includes(capa),
      keyOf: (r) => String(r.placa || r.clave_seguimiento || "").trim(),
    };
  }
  if (themeId === "banco-de-maquinaria") {
    return {
      capas: BMAQ_CAPAS,
      defaultCapa: "Maqueta / inventario",
      pinLeft: PIN_LEFT_BMAQ,
      searchLabel: "Buscar convenio / serial",
      searchPlaceholder: "9677-… o serial…",
      helpText:
        "Busque por convenio o serial. Clic en una celda para editar; el botón de versión abre el historial.",
      filterHint: " · filtro: todas las capas de ese convenio/serial",
      emptyHint:
        " (Convenio / Detalle / Bitácora / Entrega) o quite el filtro de convenio/serial.",
      normalizeCapa: (raw) => normalizeBmaqCapa(raw) || "Sin capa",
      isOfficial: (capa) => (BMAQ_CAPAS as readonly string[]).includes(capa),
      keyOf: (r) =>
        String(r.no_convenio || r.serial || r.clave_seguimiento || "").trim(),
    };
  }
  if (themeId === "puentes") {
    return {
      capas: PUENTES_CAPAS,
      defaultCapa: "Inventario puente",
      pinLeft: PIN_LEFT_PUENTES,
      searchLabel: "Buscar id puente / contrato",
      searchPlaceholder: "id puente o contrato…",
      helpText:
        "Busque por id de puente o contrato. Clic en una celda para editar; el botón de versión abre el historial.",
      filterHint: " · filtro: todas las capas de ese puente/contrato",
      emptyHint:
        " (Estructuración / Inventario / Bitácora) o quite el filtro de id/contrato.",
      normalizeCapa: (raw) => normalizePuenteCapa(raw) || "Sin capa",
      isOfficial: (capa) => (PUENTES_CAPAS as readonly string[]).includes(capa),
      keyOf: (r) =>
        String(
          r.id_puente ||
            r.contrato_convenio ||
            r.clave_proceso ||
            r.contrato ||
            r.clave_seguimiento ||
            "",
        ).trim(),
    };
  }
  if (themeId === "subsidios-de-arriendos") {
    return {
      capas: SUBSIDIOS_CAPAS,
      defaultCapa: "Consolidado / envío",
      pinLeft: PIN_LEFT_SUBSIDIOS,
      searchLabel: "Buscar UUID / envío",
      searchPlaceholder: "uuid o número de envío…",
      helpText:
        "Busque por documento o número de envío. Clic en una celda para editar.",
      filterHint: " · filtro UUID/envío",
      emptyHint: " o quite el filtro.",
      normalizeCapa: (raw) => normalizeSubsidiosCapa(raw) || "Sin capa",
      isOfficial: (capa) =>
        (SUBSIDIOS_CAPAS as readonly string[]).includes(capa),
      keyOf: (r) =>
        String(r.uuid || r.clave_seguimiento || r.numero_envio || "").trim(),
    };
  }
  // Agua y Saneamiento (default de la vista Excel histórica)
  return {
    capas: AGUA_CAPAS_UI,
    defaultCapa: "Alta / orden",
    pinLeft: PIN_LEFT_AGUA,
    searchLabel: "Buscar orden de proveeduría",
    searchPlaceholder: "GS-SMD-…",
    helpText:
      "Busque por orden de proveeduría. Clic en una celda para editar; el botón de versión abre el historial.",
    filterHint: " · filtro por orden: todos los formularios de esa orden",
    emptyHint: " o quite el filtro de orden.",
    normalizeCapa: (raw) => normalizeAguaCapa(raw) || "Sin capa",
    isOfficial: (capa) => isAguaCapaOficial(capa),
    keyOf: (r) =>
      String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim(),
  };
}

function capaOf(themeId: string, r: RecordRow) {
  return profileFor(themeId).normalizeCapa(
    String(r.tipo_registro || r.capa || ""),
  );
}

function isOfficialCapa(themeId: string, capa: string) {
  return profileFor(themeId).isOfficial(capa);
}

function keyOf(themeId: string, r: RecordRow) {
  return profileFor(themeId).keyOf(r);
}

function cellStr(row: RecordRow, name: string) {
  const v = row[name];
  if (v === undefined || v === null) return "";
  return String(v);
}

export function MaquetaExcelView({ theme, records, onChanged }: Props) {
  const { role } = useAuth();
  const writable = canWrite(role || undefined);
  const profile = useMemo(() => profileFor(theme.id), [theme.id]);
  const defaultCapa = profile.defaultCapa;

  const [keyFilter, setKeyFilter] = useState("");
  const [keyQuery, setKeyQuery] = useState("");
  const [capaFilter, setCapaFilter] = useState<string>(defaultCapa);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(true);
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
  const [selectedKey, setSelectedKey] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setCapaFilter(defaultCapa);
    setKeyFilter("");
    setKeyQuery("");
    setPage(0);
  }, [theme.id, defaultCapa]);

  const fieldsByName = useMemo(
    () => new Map(theme.fields.map((f) => [f.name, f])),
    [theme.fields],
  );

  const pinLeft = profile.pinLeft;

  const columns = useMemo(() => {
    const names = theme.fields
      .map((f) => f.name)
      .filter((n) => !HIDDEN.has(n));
    const formForCapa =
      capaFilter !== "__todas__"
        ? theme.captureForms?.find((f) => f.capa === capaFilter)
        : undefined;
    const formCols = (formForCapa?.fieldNames || []).filter(
      (n) => names.includes(n) && !HIDDEN.has(n),
    );
    const pinned = pinLeft.filter((n) => names.includes(n));

    // Por capa: columnas del formulario (completas para ver y seguir llenando)
    if (formCols.length && !showAllColumns) return formCols;

    const base = pinned.length
      ? pinned
      : names.filter((n) => n !== "valor" && n !== "fecha").slice(0, 12);

    if (!showAllColumns) return base;

    const prefer = formCols.length ? formCols : base;
    const rest = names.filter((n) => !prefer.includes(n));
    return [...prefer, ...rest];
  }, [theme.fields, theme.captureForms, showAllColumns, pinLeft, capaFilter]);

  const capas = useMemo(() => [...profile.capas], [profile]);

  // Debounce búsqueda placa/OP
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyQuery(keyFilter.trim().toLowerCase());
      setPage(0);
    }, 200);
    return () => clearTimeout(t);
  }, [keyFilter]);

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
      const capa = capaOf(theme.id, r);
      if (!isOfficialCapa(theme.id, capa) && capa !== "Sin capa") return false;
      if (capa === "Sin capa") return false;
      // Con búsqueda por placa/OP: todas las capas de esa clave.
      if (keyQuery) {
        if (!keyOf(theme.id, r).toLowerCase().includes(keyQuery)) return false;
      } else if (capaFilter !== "__todas__" && capa !== capaFilter) {
        return false;
      }
      if (onlyChanged && marksReady && !hasChanges(marks[r.id])) {
        return false;
      }
      return true;
    });
  }, [records, capaFilter, keyQuery, onlyChanged, marks, marksReady, theme.id]);

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
    setSelectedKey(keyOf(theme.id, row) || row.id.slice(0, 8));
    setHistoryOpen(true);
    void loadVersions(row.id);
  }

  function closeHistory() {
    setHistoryOpen(false);
    setSelectedId(null);
    setSelectedKey("");
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
          className={`block w-full max-w-[14rem] truncate px-1.5 py-1 text-left text-ungrd-text ${
            writable
              ? "hover:bg-ungrd-input hover:ring-1 hover:ring-ungrd-navy/40"
              : ""
          }`}
        >
          {changed ? (
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5 text-ungrd-warning" />
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
          className="w-full rounded border border-ungrd-navy bg-ungrd-input px-1 py-1 text-ungrd-text outline-none"
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
        className="w-full min-w-[7rem] rounded border border-ungrd-navy bg-ungrd-input px-1.5 py-1 text-ungrd-text outline-none"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="theme-hero rounded-xl px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
          <Table2 className="h-4 w-4 text-ungrd-heading" />
          Todos los registros
        </p>
        <p className="mt-1 text-sm text-ungrd-muted">{profile.helpText}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-ungrd-heading">
          <span className="mb-1 flex items-center gap-1 text-xs text-ungrd-muted">
            <Search className="h-3 w-3" /> {profile.searchLabel}
          </span>
          <input
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            placeholder={profile.searchPlaceholder}
            className="rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-ungrd-heading">
          <span className="mb-1 block text-xs text-ungrd-muted">Formulario</span>
          <select
            value={capaFilter}
            onChange={(e) => setCapaFilter(e.target.value)}
            className="rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2 text-sm font-normal"
          >
            <option value="__todas__">Todos los formularios</option>
            {capas.map((c) => (
              <option key={c} value={c}>
                {displayCapaLabel(theme.id, c)}
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
          Todas las columnas (base completa)
        </label>
        <span className="pb-2 text-xs text-ungrd-muted">
          {rows.length} filas · {columns.length} cols · pág. {safePage + 1}/
          {pageCount}
          {keyQuery ? profile.filterHint : ""}
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

      <div className="ungrd-data-table max-h-[70vh] overflow-auto rounded-xl border border-ungrd-border shadow-sm">
          <table className="min-w-max border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-ungrd-navy text-white">
                <th className="sticky left-0 z-30 bg-ungrd-navy px-2 py-2 font-bold text-white">
                  #
                </th>
                <th className="sticky left-8 z-30 bg-ungrd-navy px-2 py-2 font-bold text-white">
                  Formulario
                </th>
                <th className="sticky left-[7.5rem] z-30 bg-ungrd-navy px-2 py-2 font-bold text-white">
                  Ver.
                </th>
                {columns.map((name) => (
                  <th
                    key={name}
                    className="whitespace-nowrap px-2 py-2 font-bold text-white"
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
                  ? "bg-ungrd-row-selected"
                  : idx % 2
                    ? "bg-ungrd-row-alt"
                    : "bg-ungrd-row";
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-ungrd-border text-ungrd-text ${rowBg} hover:bg-ungrd-row-hover`}
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
                      className={`sticky left-8 z-20 max-w-[6.5rem] truncate px-2 py-1 font-semibold text-ungrd-heading ${rowBg}`}
                      title={displayCapaLabel(theme.id, capaOf(theme.id, row))}
                    >
                      {displayCapaLabel(theme.id, capaOf(theme.id, row))}
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
                              : "border-ungrd-warning/40 bg-ungrd-row-changed text-ungrd-heading hover:border-ungrd-navy hover:bg-ungrd-navy hover:text-white"
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
                          className={`relative min-w-[7rem] px-0.5 py-0.5 text-ungrd-text ${
                            changed ? "bg-ungrd-row-changed" : ""
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
                    No hay filas con estos filtros. Pruebe otra capa
                    {profile.emptyHint}
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
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ungrd-border bg-ungrd-surface text-ungrd-text shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ungrd-border bg-ungrd-navy px-4 py-3 text-white">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <History className="h-4 w-4" />
                  Historial de cambios
                </p>
                <p className="mt-0.5 text-xs text-white/80">
                  {profile.searchLabel.replace(/^Buscar\s+/i, "")} · {selectedKey}{" "}
                  · del más reciente al más viejo. Volver crea una versión nueva
                  (nada se elimina).
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
                    <tr className="border-b border-ungrd-border bg-ungrd-row-alt text-ungrd-heading">
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
                          className={`border-b border-ungrd-border ${
                            isCurrent ? "bg-ungrd-success/20" : "bg-ungrd-row"
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
