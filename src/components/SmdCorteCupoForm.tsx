"use client";

import { useMemo, useState } from "react";
import { formatCop, type RecordRow } from "@/lib/records/types";
import {
  aggregateSmdControlBoard,
  corteLabelFromFileName,
} from "@/themes/ejecucion-financiera/dashboard";
import {
  corteCupoClave,
  expandCuposForLinea,
  extractCorteCupos,
  lookupCorteCupo,
  parseCupoMoney,
  type CorteCupoMap,
} from "@/themes/ejecucion-financiera/corte-cupo";

type Props = {
  records: RecordRow[];
  archivo?: string;
  onSaved: () => void;
};

export function SmdCorteCupoForm({ records, archivo, onSaved }: Props) {
  const board = useMemo(() => aggregateSmdControlBoard(records), [records]);
  const corte = board.corte || (archivo ? corteLabelFromFileName(archivo) : "");
  const saved = useMemo(
    () => extractCorteCupos(records, corte),
    [records, corte],
  );
  const lineas = board.bySubcuenta;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function valueFor(linea: string, key: string): string {
    if (draft[linea] !== undefined) return draft[linea];
    const n = lookupCorteCupo(saved, key, linea);
    return n ? String(n) : "";
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const cupos: CorteCupoMap = {};
      for (const row of lineas) {
        const raw = valueFor(row.linea || row.label, row.key);
        const n = parseCupoMoney(raw);
        Object.assign(cupos, expandCuposForLinea(row.linea || row.label, n));
        if (row.key) Object.assign(cupos, expandCuposForLinea(row.key, n));
      }
      const clave = corteCupoClave(corte || "vigente");
      const res = await fetch("/api/themes/ejecucion-financiera/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "upsert",
          values: {
            no_cdp: clave,
            clave_seguimiento: clave,
            tipo_registro: "corte-cupo",
            capa: "corte-cupo",
            _kind: "corte-cupo",
            corte,
            _archivo_fuente: archivo || board.archivo || "",
            cupos,
            departamento: "SIN DEPARTAMENTO",
            municipio: "SIN MUNICIPIO",
            fecha: new Date().toISOString().slice(0, 10),
            estado: "Cupo de corte",
            valor: Object.values(cupos).reduce((s, n) => s + n, 0),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el cupo");
      setMsg("Cupo del corte guardado. El tablero usará apropiación disponible = cupo − CDP.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!lineas.length) return null;

  return (
    <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 shadow-sm">
      <h2 className="text-base font-extrabold text-ungrd-heading">
        Apropiación del corte
      </h2>
      <p className="mt-1 text-sm text-ungrd-muted">
        El Excel Fidusap no trae apropiación. Capture el cupo de cada línea
        para <strong>{corte || "el corte vigente"}</strong>. La apropiación
        disponible será cupo − CDP. En el próximo Excel vuelva a registrar
        estos valores, porque corresponden a esa fecha.
      </p>
      <div className="mt-3 overflow-auto rounded-xl border border-ungrd-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ungrd-navy text-[10px] font-bold tracking-wide text-white uppercase">
            <tr>
              <th className="px-3 py-2">Línea</th>
              <th className="px-3 py-2 text-right">CDP del corte</th>
              <th className="px-3 py-2">Apropiación (COP)</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((row) => (
              <tr key={row.key} className="border-t border-ungrd-border">
                <td className="px-3 py-2 font-semibold text-ungrd-navy">
                  {row.label}
                  <span className="mt-0.5 block text-[11px] font-normal text-ungrd-muted">
                    {row.cdpCount} CDP
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ungrd-muted">
                  {formatCop(row.cdp)}
                </td>
                <td className="px-3 py-2">
                  <input
                    inputMode="decimal"
                    className="h-9 w-full rounded-md border border-ungrd-border px-2 text-right font-semibold tabular-nums"
                    placeholder="0"
                    value={valueFor(row.linea || row.label, row.key)}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [row.linea || row.label]: e.target.value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err ? (
        <p className="mt-2 text-sm text-ungrd-danger">{err}</p>
      ) : null}
      {msg ? (
        <p className="mt-2 text-sm text-emerald-800">{msg}</p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-3 rounded-lg bg-ungrd-navy px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {busy ? "Guardando…" : "Guardar apropiación del corte"}
      </button>
    </section>
  );
}
