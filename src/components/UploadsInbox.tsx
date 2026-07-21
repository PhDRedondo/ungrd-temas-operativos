"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import type { UploadListItem } from "@/lib/uploads/types";

type Props = {
  themeId?: string;
  compact?: boolean;
};

export function UploadsInbox({ themeId, compact }: Props) {
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (themeId) qs.set("themeId", themeId);
      const res = await fetch(`/api/uploads?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setUploads(data.uploads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [themeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            className={`font-extrabold text-ungrd-heading ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            Bandeja de cargas Excel
          </h2>
          {!compact && (
            <p className="text-sm text-ungrd-muted">
              Historial auditable: archivo, usuario, aceptados/rechazados y CSV
              de errores.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-ungrd-border px-3 py-2 text-sm font-bold text-ungrd-heading hover:bg-ungrd-bg"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-ungrd-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ungrd-muted">Cargando…</p>
      ) : uploads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ungrd-border px-4 py-8 text-center text-sm text-ungrd-muted">
          Aún no hay cargas{themeId ? " en este tema" : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ungrd-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ungrd-bg text-ungrd-heading">
              <tr>
                <th className="px-3 py-2 font-bold">Fecha</th>
                {!themeId && <th className="px-3 py-2 font-bold">Tema</th>}
                <th className="px-3 py-2 font-bold">Archivo</th>
                <th className="px-3 py-2 font-bold">Usuario</th>
                <th className="px-3 py-2 font-bold">Estado</th>
                <th className="px-3 py-2 font-bold">OK</th>
                <th className="px-3 py-2 font-bold">Dup</th>
                <th className="px-3 py-2 font-bold">Errores</th>
                <th className="px-3 py-2 font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-t border-ungrd-border">
                  <td className="px-3 py-2 text-xs text-ungrd-muted whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleString("es-CO")}
                  </td>
                  {!themeId && (
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/temas/${u.themeId}`}
                        className="font-semibold text-ungrd-heading hover:underline"
                      >
                        {u.themeId}
                      </Link>
                    </td>
                  )}
                  <td className="px-3 py-2 max-w-[180px] truncate" title={u.fileName}>
                    {u.fileName}
                  </td>
                  <td className="px-3 py-2 text-xs text-ungrd-muted">
                    {u.createdByEmail || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-emerald-700">
                    {u.accepted}
                  </td>
                  <td className="px-3 py-2 font-semibold text-amber-700">
                    {u.duplicates}
                  </td>
                  <td className="px-3 py-2 font-semibold text-red-700">
                    {u.rejected}
                  </td>
                  <td className="px-3 py-2">
                    {u.errorCount > 0 ? (
                      <a
                        href={`/api/uploads/${u.id}?format=csv`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-ungrd-navy hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        CSV
                      </a>
                    ) : (
                      <span className="text-xs text-ungrd-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "done"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : status === "failed"
        ? "bg-red-50 text-red-800 border-red-200"
        : "bg-amber-50 text-amber-900 border-amber-200";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${styles}`}
    >
      {status}
    </span>
  );
}
