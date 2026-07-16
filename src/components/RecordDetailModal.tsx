"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Download, FileDown, MapPin, X } from "lucide-react";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, type RecordRow } from "@/lib/data";
import { resolveLocation } from "@/lib/geo";
import { downloadRecordPdf } from "@/lib/recordPdf";

const markerIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:999px;background:#ffd100;border:3px solid #002d5a;box-shadow:0 8px 20px rgba(0,45,90,.35)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 11);
  }, [map, lat, lng]);
  return null;
}

type Props = {
  theme: ThemeConfig;
  record: RecordRow;
  onClose: () => void;
};

export function RecordDetailModal({ theme, record, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const location = resolveLocation(
    String(record.departamento),
    String(record.municipio),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function handleDownloadPdf() {
    setExporting(true);
    try {
      downloadRecordPdf(theme, record);
    } finally {
      window.setTimeout(() => setExporting(false), 400);
    }
  }

  const entries = theme.fields
    .map((f) => ({
      label: f.label,
      name: f.name,
      value: record[f.name],
    }))
    .filter((e) => e.value !== undefined && e.value !== "");

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-detail-title"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-[#001a36]/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-ungrd-surface shadow-[0_40px_100px_rgba(0,26,54,0.55)] animate-fade-up">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#001a36_0%,#0a3d6b_55%,#002d5a_100%)] px-6 pt-6 pb-8 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-ungrd-yellow/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-24 w-64 bg-[linear-gradient(90deg,#ffd100_0%,transparent_100%)] opacity-40" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-ungrd-yellow uppercase">
                {theme.name}
              </p>
              <h2
                id="record-detail-title"
                className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl"
              >
                Detalle del registro
              </h2>
              <p className="mt-1 font-mono text-sm text-white/60">{record.id}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-xl border border-ungrd-yellow/40 bg-ungrd-yellow px-3 py-2 text-xs font-extrabold text-ungrd-navy-deep transition hover:brightness-105 disabled:opacity-60"
              >
                {exporting ? (
                  <Download className="h-4 w-4 animate-pulse" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {exporting ? "Generando…" : "Descargar PDF"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-ungrd-yellow px-3 py-1 text-xs font-extrabold text-ungrd-navy-deep">
              {String(record.estado)}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
              {String(record.fecha)}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
              {formatCop(Number(record.valor || 0))}
            </span>
          </div>
        </div>

        <div className="scroll-thin grid flex-1 gap-0 overflow-y-auto lg:grid-cols-2">
          <div className="space-y-3 border-b border-ungrd-border p-5 lg:border-r lg:border-b-0">
            <h3 className="text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              Atributos
            </h3>
            <dl className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.name}
                  className="rounded-xl border border-ungrd-border bg-ungrd-bg/80 px-3 py-2.5"
                >
                  <dt className="text-[11px] font-bold tracking-wide text-ungrd-muted uppercase">
                    {e.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ungrd-heading break-words">
                    {e.name === "valor" ||
                    (typeof e.value === "number" &&
                      String(e.name).includes("valor"))
                      ? formatCop(Number(e.value))
                      : String(e.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-ungrd-muted uppercase">
              <MapPin className="h-4 w-4 text-ungrd-navy" />
              Ubicación geográfica
            </h3>
            {location ? (
              <>
                <p className="mb-3 text-sm font-semibold text-ungrd-heading">
                  {location.label}
                </p>
                <p className="mb-3 font-mono text-xs text-ungrd-muted">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ·{" "}
                  {location.level}
                </p>
                <div className="min-h-[240px] flex-1 overflow-hidden rounded-2xl border border-ungrd-border shadow-inner">
                  <MapContainer
                    center={[location.lat, location.lng]}
                    zoom={11}
                    scrollWheelZoom={false}
                    className="h-[260px] w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Recenter lat={location.lat} lng={location.lng} />
                    <Marker
                      position={[location.lat, location.lng]}
                      icon={markerIcon}
                    />
                  </MapContainer>
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-ungrd-border bg-ungrd-bg p-6 text-sm text-ungrd-muted">
                No hay coordenadas asociadas a este departamento/municipio en el
                catálogo geo de demo.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ungrd-border bg-ungrd-bg/60 px-5 py-3">
          <p className="text-xs text-ungrd-muted">
            Exporta este registro con atributos y ubicación en formato PDF.
          </p>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl bg-ungrd-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ungrd-navy-deep disabled:opacity-60"
          >
            <FileDown className="h-4 w-4 text-ungrd-yellow" />
            {exporting ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </div>
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,#ffd100_0%,#002d5a_55%,#ce1126_100%)]" />
      </div>
    </div>
  );
}
