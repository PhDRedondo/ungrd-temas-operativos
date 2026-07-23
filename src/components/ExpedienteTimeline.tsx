"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { formatCop, formatNumber } from "@/lib/records/types";
import type { CrosswalkResult, CrosswalkType } from "@/lib/analytics/crosswalk";

const TYPES: { id: CrosswalkType; label: string; hint: string }[] = [
  { id: "op", label: "OP", hint: "Orden de proveeduría (Agua ↔ Obras)" },
  { id: "placa", label: "Placa", hint: "Carrotanques / maquinaria" },
  { id: "cdp", label: "CDP", hint: "FIC / Agua" },
  {
    id: "declaratoria",
    label: "Declaratoria",
    hint: "Nº decreto + territorio",
  },
];

export function ExpedienteTimeline() {
  const [type, setType] = useState<CrosswalkType>("op");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrosswalkResult | null>(null);

  async function search() {
    setError(null);
    setResult(null);
    if (!key.trim()) {
      setError("Ingrese una clave (OP, placa, CDP o Nº declaratoria).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/analytics/crosswalk?type=${type}&key=${encodeURIComponent(key.trim())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo consultar el cruce");
        return;
      }
      setResult(data as CrosswalkResult);
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
      <h3 className="text-sm font-extrabold text-ungrd-heading">
        Expediente interconectado
      </h3>
      <p className="mt-1 text-xs text-ungrd-muted">
        Busque por clave de negocio y vea el timeline en todas las bases
        oficiales relacionadas.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              type === t.id
                ? "bg-ungrd-navy text-white"
                : "bg-ungrd-bg text-ungrd-muted ring-1 ring-ungrd-border"
            }`}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder={
            type === "op"
              ? "Ej. SMD-GS-MQ-151-2023"
              : type === "placa"
                ? "Ej. OCJ581"
                : type === "cdp"
                  ? "Ej. No. CDP"
                  : "Ej. Nº declaratoria"
          }
          className="min-w-0 flex-1 rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm font-semibold text-ungrd-text"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void search()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ungrd-yellow px-4 py-2.5 text-sm font-extrabold text-ungrd-navy-deep disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar cruce
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-ungrd-muted">
            Clave normalizada: <strong>{result.normalizedKey || "—"}</strong> ·{" "}
            {formatNumber(result.events.length)} eventos · Temas:{" "}
            {result.relatedThemes.join(", ") || "ninguno"}
          </p>

          {result.territorial.length > 0 ? (
            <div>
              <h4 className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
                Territorio asociado
              </h4>
              <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-sm">
                {result.territorial.slice(0, 12).map((t) => (
                  <li
                    key={`${t.departamento}-${t.municipio}`}
                    className="rounded-lg border border-ungrd-border px-3 py-1.5"
                  >
                    <span className="font-bold text-ungrd-heading">
                      {t.municipio !== "—" ? `${t.municipio}, ` : ""}
                      {t.departamento}
                    </span>
                    <span className="ml-2 text-xs text-ungrd-muted">
                      {Object.entries(t.themeCounts)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="text-xs font-extrabold tracking-wide text-ungrd-navy uppercase">
              Timeline
            </h4>
            {result.events.length === 0 ? (
              <p className="mt-2 text-sm text-ungrd-muted">
                Sin coincidencias en las bases cargadas.
              </p>
            ) : (
              <ol className="mt-2 max-h-80 space-y-2 overflow-auto border-l-2 border-ungrd-navy/30 pl-3">
                {result.events.map((e) => (
                  <li key={`${e.themeId}-${e.id}`} className="relative text-sm">
                    <span className="absolute top-1.5 -left-[1.05rem] h-2.5 w-2.5 rounded-full bg-ungrd-navy" />
                    <p className="font-extrabold text-ungrd-heading">
                      {e.fecha || "s/f"} · {e.themeLabel}
                    </p>
                    <p className="text-ungrd-muted">
                      {e.capa} · {e.estado} · {e.clave}
                    </p>
                    <p className="text-xs text-ungrd-muted">
                      {[e.municipio, e.departamento].filter(Boolean).join(", ")}
                      {e.valor > 0 ? ` · ${formatCop(e.valor)}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
