"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { DEPARTMENTS } from "@/lib/geo";
import {
  CHOROPLETH_COLORS,
  classForValue,
  colorForClass,
  quantileBreaks,
  resolveDepartment,
  type AreaStat,
  type MapMetric,
} from "@/lib/geo/spatial";
import { formatCop, formatNumber } from "@/lib/records/types";

export type MapPoint = {
  name: string;
  code?: string;
  lat: number;
  lng: number;
  value: number;
  level: "departamento" | "municipio";
};

type DeptProps = {
  dpto_ccdgo?: string;
  dpto_cnmbr?: string;
};

const GEO_URL = "/geo/departamentos-mgn2024.json";

function FitBounds({
  points,
  department,
}: {
  points: MapPoint[];
  department?: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (department) {
      const dept = resolveDepartment(department) || DEPARTMENTS.find((d) => d.name === department);
      if (dept) {
        map.setView([dept.lat, dept.lng], 7.2);
        return;
      }
    }
    const withData = points.filter((p) => p.value > 0);
    if (!withData.length) {
      map.setView([4.5, -74.1], 5.2);
      return;
    }
    const lats = withData.map((p) => p.lat);
    const lngs = withData.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.35, Math.min(...lngs) - 0.35],
        [Math.max(...lats) + 0.35, Math.max(...lngs) + 0.35],
      ],
      { padding: [28, 28], maxZoom: 7.5 },
    );
  }, [map, points, department]);
  return null;
}

function formatMetric(
  value: number,
  metric: MapMetric,
  custom?: (value: number, metric: MapMetric) => string,
) {
  if (custom) return custom(value, metric);
  return metric === "valor" ? formatCop(value) : `${formatNumber(value)} reg.`;
}

function shortMetric(value: number, metric: MapMetric) {
  if (metric === "count") return formatNumber(value);
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return formatNumber(value);
}

export function ColombiaMap({
  areas,
  metric,
  selectedDepartment,
  selectedName,
  onSelect,
  onClearDepartment,
  metricLabel,
  legendTitle,
  legendHint,
  tooltipPrimaryLabel,
  formatValue,
}: {
  areas: AreaStat[];
  metric: MapMetric;
  selectedDepartment: string;
  selectedName?: string;
  onSelect?: (point: MapPoint) => void;
  onClearDepartment?: () => void;
  /** Chip de métrica (ej. "Coropleta · Nº puentes") */
  metricLabel?: string;
  /** Título de la caja de leyenda (reemplaza el genérico "Intensidad") */
  legendTitle?: string;
  legendHint?: string;
  /** Etiqueta del valor principal en tooltip */
  tooltipPrimaryLabel?: string;
  formatValue?: (value: number, metric: MapMetric) => string;
}) {
  const [mounted, setMounted] = useState(false);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(GEO_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FeatureCollection;
        if (!cancelled) setGeo(data);
      } catch (err) {
        if (!cancelled) {
          setGeoError(
            err instanceof Error ? err.message : "No se pudo cargar el mapa",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const byName = useMemo(() => {
    const m = new Map<string, AreaStat>();
    for (const a of areas) m.set(a.name, a);
    return m;
  }, [areas]);

  const values = useMemo(
    () =>
      areas.map((a) => (metric === "valor" ? a.valor : a.count)).filter((v) => v > 0),
    [areas, metric],
  );
  const breaks = useMemo(() => quantileBreaks(values, 5), [values]);
  const total = useMemo(
    () => values.reduce((s, v) => s + v, 0),
    [values],
  );

  const points = useMemo(() => {
    if (selectedDepartment) {
      const dept = resolveDepartment(selectedDepartment);
      if (!dept) return [] as MapPoint[];
      return dept.municipalities.map((m) => {
        const stat = byName.get(m.name);
        return {
          name: m.name,
          code: m.code,
          lat: m.lat,
          lng: m.lng,
          value: metric === "valor" ? stat?.valor || 0 : stat?.count || 0,
          level: "municipio" as const,
        };
      });
    }
    return DEPARTMENTS.map((d) => {
      const stat = byName.get(d.name);
      return {
        name: d.name,
        code: d.code,
        lat: d.lat,
        lng: d.lng,
        value: metric === "valor" ? stat?.valor || 0 : stat?.count || 0,
        level: "departamento" as const,
      };
    });
  }, [byName, metric, selectedDepartment]);

  const showChoropleth = !selectedDepartment;
  const areasConDato = areas.filter((a) =>
    metric === "valor" ? a.valor > 0 : a.count > 0,
  ).length;

  const styleFeature = (feature?: Feature<Geometry, DeptProps>): PathOptions => {
    const code = String(feature?.properties?.dpto_ccdgo || "");
    const dept =
      DEPARTMENTS.find((d) => d.code === code) ||
      resolveDepartment(String(feature?.properties?.dpto_cnmbr || ""));
    const nice = dept?.name || String(feature?.properties?.dpto_cnmbr || "");
    const stat = byName.get(nice);
    const value = metric === "valor" ? stat?.valor || 0 : stat?.count || 0;
    const cls = classForValue(value, breaks);
    const active = selectedName === nice;
    const isHover = hovered === nice;
    return {
      color: active ? "#ffd100" : isHover ? "#001a36" : "#ffffff",
      weight: active ? 3 : isHover ? 2 : 0.8,
      fillColor: colorForClass(cls),
      fillOpacity: value > 0 ? (active ? 0.95 : isHover ? 0.9 : 0.82) : 0.22,
    };
  };

  const onEachFeature = (
    feature: Feature<Geometry, DeptProps>,
    layer: Layer,
  ) => {
    const code = String(feature.properties?.dpto_ccdgo || "");
    const dept =
      DEPARTMENTS.find((d) => d.code === code) ||
      resolveDepartment(String(feature.properties?.dpto_cnmbr || ""));
    if (!dept) return;
    const nice = dept.name;
    const stat = byName.get(nice);
    const value = metric === "valor" ? stat?.valor || 0 : stat?.count || 0;
    const count = stat?.count || 0;
    const valor = stat?.valor || 0;
    const share = total > 0 && value > 0 ? ((value / total) * 100).toFixed(1) : "0";

    const primaryLabel =
      tooltipPrimaryLabel ||
      (metric === "valor" ? "Valor (COP)" : "Registros");
    const primaryValue = formatValue
      ? formatValue(value, metric)
      : metric === "valor"
        ? formatCop(valor)
        : formatNumber(count);
    const secondary = formatValue
      ? count > 0
        ? `Registros: ${formatNumber(count)}`
        : ""
      : metric === "valor"
        ? `Registros: ${formatNumber(count)}`
        : valor > 0
          ? `Valor (COP): ${formatCop(valor)}`
          : "";

    layer.bindTooltip(
      `<div style="font:12px/1.35 system-ui,sans-serif;min-width:140px">
        <strong style="font-size:13px">${nice}</strong><br/>
        ${primaryLabel}: <b>${primaryValue}</b><br/>
        ${secondary}
        ${value > 0 ? `<br/>Participación: <b>${share}%</b>` : "<br/><span style='color:#666'>Sin dato en filtro actual</span>"}
        <br/><em style="color:#0a3d6b">Clic para filtrar el tablero</em>
      </div>`,
      { sticky: true, opacity: 0.97 },
    );

    layer.on({
      mouseover: () => setHovered(nice),
      mouseout: () => setHovered((h) => (h === nice ? null : h)),
      click: () => {
        onSelect?.({
          name: dept.name,
          code: dept.code,
          lat: dept.lat,
          lng: dept.lng,
          value,
          level: "departamento",
        });
      },
    });
  };

  if (!mounted || (!geo && !geoError)) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-xl border border-ungrd-border bg-ungrd-bg text-sm text-ungrd-muted">
        Cargando coropleta MGN…
      </div>
    );
  }

  if (geoError || !geo) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm text-ungrd-danger">
        Error al cargar polígonos MGN: {geoError}
      </div>
    );
  }

  const short = (v: number) =>
    formatValue ? formatValue(v, metric) : shortMetric(v, metric);

  const legendItems = breaks.length
    ? breaks.map((b, i) => ({
        color: colorForClass(i),
        label:
          i === 0
            ? `≤ ${short(b)}`
            : `${short(breaks[i - 1]!)} – ${short(b)}`,
      }))
    : [{ color: "#e8eef4", label: "Sin datos" }];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-ungrd-navy px-2.5 py-1 font-bold text-white">
          {areasConDato} {selectedDepartment ? "municipios" : "deptos"} con dato
        </span>
        <span className="rounded-full bg-ungrd-bg px-2.5 py-1 font-semibold text-ungrd-heading ring-1 ring-ungrd-border">
          Total: {formatMetric(total, metric, formatValue)}
        </span>
        <span className="rounded-full bg-ungrd-bg px-2.5 py-1 font-semibold text-ungrd-muted ring-1 ring-ungrd-border">
          {metricLabel ||
            (metric === "valor"
              ? "Coropleta por valor $"
              : "Coropleta por nº registros")}
        </span>
        {selectedDepartment ? (
          <button
            type="button"
            onClick={onClearDepartment}
            className="rounded-full bg-ungrd-yellow px-2.5 py-1 font-extrabold text-ungrd-navy-deep"
          >
            ← Volver a Colombia
          </button>
        ) : null}
      </div>

      <div className="relative min-w-0 max-w-full overflow-hidden rounded-xl border border-ungrd-border">
        <MapContainer
          key={`map-${selectedDepartment || "all"}-${metric}`}
          center={[4.5, -74.1]}
          zoom={5.2}
          scrollWheelZoom
          className="h-[280px] w-full sm:h-[420px]"
        >
          <TileLayer
            attribution='&copy; OSM · MGN DANE 2024'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          <FitBounds points={points} department={selectedDepartment || undefined} />

          {showChoropleth && (
            <GeoJSON
              key={`choropleth-${metric}-${areas.length}-${selectedName || ""}-${breaks.join(",")}`}
              data={geo}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          )}

          {!showChoropleth &&
            points
              .filter((p) => p.value > 0)
              .map((p) => {
                const cls = classForValue(p.value, breaks);
                const maxV = Math.max(...values, 1);
                const radius = 6 + (p.value / maxV) * 18;
                const active = selectedName === p.name;
                return (
                  <CircleMarker
                    key={`${p.level}-${p.name}`}
                    center={[p.lat, p.lng]}
                    radius={active ? radius + 3 : radius}
                    eventHandlers={{ click: () => onSelect?.(p) }}
                    pathOptions={{
                      color: active ? "#ffd100" : "#001a36",
                      weight: active ? 3 : 1.2,
                      fillColor: colorForClass(cls),
                      fillOpacity: 0.88,
                    }}
                  >
                    <Popup>
                      <strong>{p.name}</strong>
                      <br />
                      {formatMetric(p.value, metric)}
                      <br />
                      <em>Clic para filtrar</em>
                    </Popup>
                  </CircleMarker>
                );
              })}
        </MapContainer>

        <div className="pointer-events-none absolute right-2 bottom-2 z-[500] max-w-[12.5rem] rounded-lg border border-ungrd-border/80 bg-white/95 p-2 shadow-md backdrop-blur-sm">
          <p className="mb-1.5 text-[10px] font-extrabold leading-tight tracking-wide text-ungrd-navy uppercase">
            {legendTitle ||
              (metric === "valor" ? "Valor (COP)" : "Nº registros")}
          </p>
          <ul className="space-y-1">
            <li className="flex items-center gap-1.5 text-[10px] text-ungrd-muted">
              <span
                className="h-2.5 w-3.5 shrink-0 rounded-sm"
                style={{ background: "#e8eef4" }}
              />
              Sin dato
            </li>
            {legendItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-ungrd-heading"
              >
                <span
                  className="h-2.5 w-3.5 shrink-0 rounded-sm ring-1 ring-black/10"
                  style={{ background: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] leading-tight text-ungrd-muted">
            {legendHint ||
              (metric === "valor"
                ? "Cuantiles de valor $ · más cálido = mayor monto"
                : "Cuantiles de conteo · más cálido = mayor cantidad")}
          </p>
        </div>
      </div>

      {/* muestra de escala de color */}
      <div className="flex h-2 overflow-hidden rounded-full">
        {CHOROPLETH_COLORS.map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
