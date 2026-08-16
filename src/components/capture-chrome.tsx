"use client";

import type { CaptureFormConfig } from "@/lib/themes";
import type { OrdenLookupHit } from "@/components/OrdenLookup";
import type { PuenteLookupHit } from "@/components/PuenteLookup";
import type { ProcesoLookupHit } from "@/components/ProcesoLookup";

function modeLabel(mode: CaptureFormConfig["mode"]): string {
  if (mode === "append") return "Eventos";
  if (mode === "upsert") return "Actualizar";
  return "Nuevo";
}

export function CaptureFormStepper({
  forms,
  activeId,
  onSelect,
}: {
  forms: CaptureFormConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (forms.length <= 1) return null;
  return (
    <nav
      aria-label="Formularios del tema"
      className="flex gap-2 overflow-x-auto px-0.5 pb-1 lg:sticky lg:top-20 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {forms.map((f, i) => {
        const active = f.id === activeId;
        const title = f.label.replace(/^\d+\s*·\s*/, "");
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className={`min-w-[12.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition lg:min-w-0 ${
              active
                ? "theme-mark border-transparent"
                : "border-ungrd-border bg-ungrd-surface text-ungrd-heading hover:border-[color-mix(in_srgb,var(--theme-accent)_50%,var(--ungrd-border))]"
            }`}
          >
            <span className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold ${
                  active
                    ? "bg-white/20"
                    : "bg-[color-mix(in_srgb,var(--theme-accent)_14%,transparent)] text-[var(--theme-ink)]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[10px] font-extrabold tracking-[0.14em] uppercase ${
                    active ? "opacity-80" : "text-ungrd-muted"
                  }`}
                >
                  {modeLabel(f.mode)}
                </span>
                <span className="mt-0.5 block text-sm font-extrabold leading-snug">
                  {title}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function CaptureIdentityFicha({
  lookupBy,
  orden,
  puente,
  proceso,
}: {
  lookupBy?: "orden" | "placa" | "serial" | "convenio" | "contrato";
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
            : "Orden de proveeduría";
    rows.push({
      k: keyLabel,
      v: orden.display_op || orden.orden_de_proveeduria,
    });
    if (orden.proveedor) rows.push({ k: "Proveedor", v: String(orden.proveedor) });
    const lugar = [orden.departamento, orden.municipio].filter(Boolean).join(" · ");
    if (lugar) rows.push({ k: "Territorio", v: lugar });
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
