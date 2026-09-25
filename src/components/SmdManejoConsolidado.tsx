"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCop } from "@/lib/records/types";

type Row = {
  id: string;
  theme_id: string;
  origen: string;
  modalidad: string;
  linea: string;
  clave: string;
  detalle: string;
  departamento: string;
  municipio: string;
  estado: string;
  valor: string;
  fecha: string;
  resolucion: string;
  pestana: string;
};

export function SmdManejoConsolidado() {
  const [rows, setRows] = useState<Row[]>([]);
  const [modalidad, setModalidad] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/themes/ejecucion-financiera/manejo", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo cargar Todo Manejo");
        if (!cancelled) {
          setRows((data.rows || []) as Row[]);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const modalidades = useMemo(
    () => [...new Set(rows.map((r) => r.modalidad).filter(Boolean))].sort(),
    [rows],
  );
  const visible = rows.filter((r) => {
    if (modalidad && r.modalidad !== modalidad) return false;
    if (!q.trim()) return true;
    const blob = `${r.clave} ${r.linea} ${r.detalle} ${r.departamento} ${r.municipio}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-extrabold text-ungrd-heading">Todo Manejo</h2>
        <p className="mt-1 text-sm text-ungrd-muted">
          OP Center es la base. Maquinaria, Agua y las demás líneas suman solo
          lo que todavía no está: si la clave ya existe, no se duplica. Lo que
          se guarde en esos formularios entra aquí. El CDP de Fidusap no entra.
          Quick BI lee la misma vista: medallion.v_manejo_consolidado.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-ungrd-border bg-white px-2 text-sm font-semibold"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value)}
        >
          <option value="">Todas las modalidades</option>
          {modalidades.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="h-9 min-w-56 flex-1 rounded-md border border-ungrd-border px-2 text-sm"
          placeholder="Buscar clave, línea o detalle…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-ungrd-danger">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando consolidado…</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-ungrd-border bg-white">
          <table className="min-w-[72rem] w-full text-left text-sm">
            <thead className="bg-ungrd-navy text-[10px] font-bold tracking-wide text-white uppercase">
              <tr>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Línea</th>
                <th className="px-3 py-2">Clave</th>
                <th className="px-3 py-2">Detalle</th>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-ungrd-muted">
                    No hay filas para este filtro.
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-2">{row.origen}</td>
                    <td className="px-3 py-2 font-semibold text-ungrd-navy">{row.modalidad}</td>
                    <td className="px-3 py-2">{row.linea}</td>
                    <td className="px-3 py-2">{row.clave}</td>
                    <td className="max-w-md px-3 py-2">{row.detalle}</td>
                    <td className="px-3 py-2">{row.departamento}</td>
                    <td className="px-3 py-2">{row.estado}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCop(Number(row.valor) || 0)}
                    </td>
                    <td className="px-3 py-2">{row.fecha}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ungrd-muted">{visible.length} filas</p>
    </section>
  );
}
