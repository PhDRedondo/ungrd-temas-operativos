"use client";

import type { CaptureFormConfig } from "@/lib/themes";
import type { OrdenLookupHit } from "@/components/OrdenLookup";
import type { PuenteLookupHit } from "@/components/PuenteLookup";
import type { ProcesoLookupHit } from "@/components/ProcesoLookup";
import { displayFormStepTitle } from "@/lib/capa-display";

export function CaptureFormStepper({
  themeId,
  forms,
  activeId,
  onSelect,
}: {
  themeId: string;
  forms: CaptureFormConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (forms.length <= 1) return null;
  return (
    <nav
      aria-label="Pasos del formulario"
      className="flex gap-1.5 overflow-x-auto px-0.5 pb-1 lg:sticky lg:top-20 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {forms.map((f, i) => {
        const active = f.id === activeId;
        const title = displayFormStepTitle(themeId, f);
        return (
          <button
            key={f.id}
            type="button"
            title={title}
            onClick={() => onSelect(f.id)}
            className={`flex min-w-[9.5rem] shrink-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition lg:min-w-0 lg:w-full ${
              active
                ? "theme-mark border-transparent shadow-sm"
                : "border-ungrd-border bg-ungrd-surface text-ungrd-heading hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--theme-accent)_55%,var(--ungrd-border))] hover:bg-[color-mix(in_srgb,var(--theme-accent)_8%,var(--ungrd-surface))]"
            }`}
          >
            <span
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold tabular-nums ${
                active
                  ? "bg-white/20 text-inherit"
                  : "bg-[color-mix(in_srgb,var(--theme-accent)_14%,transparent)] text-[var(--theme-ink)]"
              }`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 truncate text-[12px] font-extrabold leading-snug lg:whitespace-normal lg:line-clamp-2">
              {title}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function CaptureIdentityFicha({
  lookupBy,
  themeId,
  orden,
  puente,
  proceso,
}: {
  lookupBy?: "orden" | "placa" | "serial" | "convenio" | "contrato";
  themeId?: string;
  orden: OrdenLookupHit | null;
  puente: PuenteLookupHit | null;
  proceso: ProcesoLookupHit | null;
}) {
  const rows: { k: string; v: string }[] = [];
  if (orden) {
    const keyLabel =
      lookupBy === "placa"
        ? "Placa"
        : lookupBy === "serial"
          ? "Serial"
          : lookupBy === "convenio" || lookupBy === "contrato"
            ? "Convenio / orden de compra"
            : themeId === "fic"
              ? "FIC"
              : "Orden de proveeduría";
    rows.push({
      k: keyLabel,
      v: orden.display_op || orden.orden_de_proveeduria,
    });
    if (themeId === "fic") {
      const depto = String(orden.departamento || "").trim();
      const muni = String(orden.municipio || "").trim();
      if (depto) rows.push({ k: "Departamento", v: depto });
      if (muni) rows.push({ k: "Municipio", v: muni });
      const p = orden.payload || {};
      const plazoIni = String(p.plazo_ejecucion_dias ?? "").trim();
      const fechaIni = String(p.fecha_inicial_para_legalizacion ?? "")
        .trim()
        .slice(0, 10);
      if (plazoIni) rows.push({ k: "Plazo inicial (días)", v: plazoIni });
      if (fechaIni) rows.push({ k: "Fecha inicial legalización", v: fechaIni });
    } else {
      if (orden.proveedor) {
        rows.push({ k: "Proveedor", v: String(orden.proveedor) });
      }
      const lugar = [orden.departamento, orden.municipio]
        .filter(Boolean)
        .join(" · ");
      if (lugar) rows.push({ k: "Territorio", v: lugar });
    }
  }
  if (puente) {
    rows.push({ k: "ID puente", v: puente.id_puente });
    if (puente.codigo_operativo) {
      rows.push({ k: "ID único", v: puente.codigo_operativo });
    }
    const lugar = [puente.departamento, puente.municipio]
      .filter(Boolean)
      .join(" · ");
    if (lugar) rows.push({ k: "Territorio", v: lugar });
  }
  if (proceso) {
    rows.push({ k: "Contrato", v: proceso.contrato_convenio });
    if (proceso.clave_proceso) {
      rows.push({ k: "Proceso", v: proceso.clave_proceso });
    }
  }
  if (!rows.length) return null;

  return (
    <aside className="rounded-xl border border-[color-mix(in_srgb,var(--theme-accent)_28%,var(--ungrd-border))] bg-[color-mix(in_srgb,var(--theme-wash)_75%,var(--ungrd-surface))] px-3 py-2.5">
      <p className="text-[10px] font-extrabold tracking-[0.16em] text-[var(--theme-ink)] uppercase">
        Seleccionado
      </p>
      <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.k} className="min-w-0">
            <dt className="text-[10px] font-bold tracking-wide text-ungrd-muted uppercase">
              {r.k}
            </dt>
            <dd className="truncate text-sm font-extrabold text-ungrd-heading">
              {r.v}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
