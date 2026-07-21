"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeIcon } from "@/components/ThemeIcon";

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
        const data = await res.json();
        if (!cancelled && res.ok) setThemes(data.themes || []);
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
          Panel general
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ungrd-muted">
          Solo ve los temas a los que tiene acceso. Use{" "}
          <Link href="/app/cargas" className="font-semibold underline">
            Cargas Excel
          </Link>{" "}
          para el historial auditable, o{" "}
          <Link href="/app/admin/permisos" className="font-semibold underline">
            Permisos
          </Link>{" "}
          (admin) para restringir por área.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando temas…</p>
      ) : themes.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
          No tiene temas asignados. Un admin debe configurar permisos, o inicie
          sesión sin ACL (modo local amplio).
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => {
            const isTemplate = theme.id === "plantilla";
            return (
              <Link
                key={theme.id}
                href={`/app/temas/${theme.id}`}
                className={
                  isTemplate
                    ? "group rounded-2xl border border-dashed border-ungrd-navy/40 bg-ungrd-surface p-4 transition hover:border-ungrd-navy hover:shadow-[0_12px_30px_rgba(0,45,90,0.08)]"
                    : "group rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 transition hover:border-ungrd-navy/30 hover:shadow-[0_12px_30px_rgba(0,45,90,0.08)]"
                }
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg bg-ungrd-navy p-2 text-ungrd-yellow transition group-hover:bg-ungrd-navy-mid">
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
                <p className="mt-2 text-[11px] font-bold tracking-wide text-ungrd-navy uppercase">
                  {theme.canWrite ? "Lectura + escritura" : "Solo lectura"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
