"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ThemeIcon } from "@/components/ThemeIcon";
import { readJson } from "@/lib/http/read-json";
import { getThemeVisual } from "@/lib/theme-visuals";

type AccessTheme = {
  id: string;
  name: string;
  description: string;
  icon: string;
  canWrite: boolean;
};

export default function AppHomePage() {
  const [themes, setThemes] = useState<AccessTheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me/access");
        const parsed = await readJson<{ themes?: AccessTheme[] }>(res);
        if (!cancelled && parsed.ok) setThemes(parsed.data.themes || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ungrd-heading">
          Temas operativos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
          Elija un tema para capturar o consultar información.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando temas…</p>
      ) : themes.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
          No tiene temas asignados. Solicite acceso a un administrador.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => {
            const isTemplate = theme.id === "plantilla";
            const visual = getThemeVisual(theme.id);
            return (
              <Link
                key={theme.id}
                href={`/app/temas/${theme.id}`}
                className={
                  isTemplate
                    ? "group rounded-2xl border border-dashed border-ungrd-navy/40 bg-ungrd-surface p-4 transition hover:-translate-y-0.5 hover:border-ungrd-navy hover:shadow-md"
                    : "group rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--card-accent)_40%,var(--ungrd-border))] hover:shadow-md"
                }
                style={
                  {
                    "--card-accent": visual.accent,
                    background: `linear-gradient(165deg, color-mix(in srgb, ${visual.wash} 55%, var(--ungrd-surface)) 0%, var(--ungrd-surface) 62%)`,
                  } as CSSProperties
                }
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div
                    className="inline-flex rounded-lg p-2"
                    style={{
                      background: visual.accent,
                      color: visual.onAccent,
                    }}
                  >
                    <ThemeIcon name={theme.icon} className="h-5 w-5" />
                  </div>
                  {isTemplate && (
                    <span className="rounded-full bg-ungrd-yellow px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-ungrd-navy-deep uppercase">
                      Referencia
                    </span>
                  )}
                </div>
                <h2 className="font-extrabold text-ungrd-heading">
                  {theme.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-ungrd-muted">
                  {theme.description}
                </p>
                <p
                  className="mt-2 text-[11px] font-bold tracking-wide uppercase"
                  style={{ color: visual.accent }}
                >
                  {theme.canWrite ? "Puede editar" : "Solo consulta"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
