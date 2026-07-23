"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { normalizeTrackingKey } from "@/lib/analytics/enrichRecords";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";

type Event = {
  id: string;
  fecha: string;
  capa: string;
  estado: string;
  clave: string;
  valor: number;
  municipio: string;
  departamento: string;
};

/**
 * Timeline de capas (maqueta / bitácora / pago…) dentro de un solo tema.
 * Solo lectura: ayuda al equipo a ver el seguimiento de una clave.
 */
export function ClaveCapasTimeline({
  records,
  themeName,
}: {
  records: RecordRow[];
  themeName: string;
}) {
  const [query, setQuery] = useState("");

  const events = useMemo(() => {
    const q = normalizeTrackingKey(query);
    if (!q || q.length < 2) return [] as Event[];
    const out: Event[] = [];
    for (const r of records) {
      const clave = normalizeTrackingKey(
        r.clave_seguimiento ||
          r.orden_de_proveeduria ||
          r.placa ||
          r.serial ||
          r.no_cdp ||
          r.no_declaratoria ||
          r.no_convenio ||
          "",
      );
      if (!clave) continue;
      if (!clave.includes(q) && !q.includes(clave)) continue;
      out.push({
        id: String(r.id),
        fecha: String(r.fecha || "").slice(0, 10),
        capa: String(r.tipo_registro || r.capa || "Registro"),
        estado: String(r.estado || "—"),
        clave: String(
          r.clave_seguimiento ||
            r.orden_de_proveeduria ||
            r.placa ||
            r.serial ||
            "—",
        ),
        valor: Number(r.valor || 0),
        municipio: String(r.municipio || ""),
        departamento: String(r.departamento || ""),
      });
    }
    out.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return out.slice(0, 80);
  }, [records, query]);

  const capas = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.capa, (m.get(e.capa) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  return (
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
      <h3 className="text-sm font-extrabold text-ungrd-heading">
        Seguimiento por clave · {themeName}
      </h3>
      <p className="mt-1 text-xs text-ungrd-muted">
        Escriba una OP, placa, CDP o Nº declaratoria para ver maqueta, bitácora
        y demás capas cargadas en este tema.
      </p>
      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-ungrd-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. SMD-GS-MQ-151-2023 o placa OCJ581"
            className="w-full rounded-lg border border-ungrd-border bg-ungrd-input py-2.5 pr-3 pl-9 text-sm font-semibold text-ungrd-text"
          />
        </div>
      </div>

      {query.trim().length >= 2 && capas.length > 0 ? (
        <p className="mt-2 text-xs text-ungrd-muted">
          Capas encontradas:{" "}
          {capas.map(([c, n]) => `${c} (${n})`).join(" · ")}
        </p>
      ) : null}

      {query.trim().length >= 2 && events.length === 0 ? (
        <p className="mt-3 text-sm text-ungrd-muted">
          Sin coincidencias en {themeName}. Verifique la clave o cargue la capa
          (maqueta/bitácora) en Captura.
        </p>
      ) : null}

      {events.length > 0 ? (
        <ol className="mt-3 max-h-80 space-y-2 overflow-auto border-l-2 border-ungrd-navy/30 pl-3">
          {events.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute top-1.5 -left-[1.05rem] h-2.5 w-2.5 rounded-full bg-ungrd-navy" />
              <p className="font-extrabold text-ungrd-heading">
                {e.fecha || "s/f"} · {e.capa}
              </p>
              <p className="text-ungrd-muted">
                {e.estado} · {e.clave}
                {e.valor > 0 ? ` · ${formatCop(e.valor)}` : ""}
              </p>
              <p className="text-xs text-ungrd-muted">
                {[e.municipio, e.departamento].filter(Boolean).join(", ") ||
                  "Sin geo"}
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-2 text-xs text-ungrd-muted">
          Escriba al menos 2 caracteres ({formatNumber(records.length)} registros
          en filtro actual).
        </p>
      ) : null}
    </section>
  );
}
