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

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) {
      map.setView([4.5, -74.1], 5.2);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.4, Math.min(...lngs) - 0.4],
        [Math.max(...lats) + 0.4, Math.max(...lngs) + 0.4],
      ],
      { padding: [24, 24] },
    );
  }, [map, points]);
  return null;
}

function nameByCode(code: string): string | undefined {
  return DEPARTMENTS.find((d) => d.code === code)?.name;
}

function deptValue(
  aggregation: Record<string, number>,
  code: string,
  rawName: string,
): number {
  const nice = nameByCode(code);
  if (nice && aggregation[nice] != null) return aggregation[nice];
  if (aggregation[rawName] != null) return aggregation[rawName];
  const hit = Object.keys(aggregation).find(
    (k) => k.toLowerCase() === rawName.toLowerCase(),
  );
  return hit ? aggregation[hit]! : 0;
}

export function ColombiaMap({
  aggregation,
  selectedDepartment,
  selectedName,
  onSelect,
}: {
  aggregation: Record<string, number>;
  selectedDepartment: string;
  selectedName?: string;
  onSelect?: (point: MapPoint) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

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

  const points = useMemo(() => {
    if (selectedDepartment) {
      const dept = DEPARTMENTS.find((d) => d.name === selectedDepartment);
      if (!dept) return [] as MapPoint[];
      return dept.municipalities.map((m) => ({
        name: m.name,
        code: m.code,
        lat: m.lat,
        lng: m.lng,
        value: aggregation[m.name] || 0,
        level: "municipio" as const,
      }));
    }
    return DEPARTMENTS.map((d) => ({
      name: d.name,
      code: d.code,
      lat: d.lat,
      lng: d.lng,
      value: aggregation[d.name] || 0,
      level: "departamento" as const,
    }));
  }, [aggregation, selectedDepartment]);

  const max = Math.max(...points.map((p) => p.value), 1);
  const showChoropleth = !selectedDepartment;

  const styleFeature = (feature?: Feature<Geometry, DeptProps>): PathOptions => {
    const code = String(feature?.properties?.dpto_ccdgo || "");
    const raw = String(feature?.properties?.dpto_cnmbr || "");
    const nice = nameByCode(code) || raw;
    const value = deptValue(aggregation, code, raw);
    const intensity = value / max;
    const active = selectedName === nice;
    return {
      color: active ? "#ffd100" : "#001a36",
      weight: active ? 2.5 : 1,
      fillColor: value > 0 ? "#ffd100" : "#9db5c8",
      fillOpacity: value > 0 ? 0.25 + intensity * 0.65 : 0.12,
    };
  };

  const onEachFeature = (
    feature: Feature<Geometry, DeptProps>,
    layer: Layer,
  ) => {
    const code = String(feature.properties?.dpto_ccdgo || "");
    const raw = String(feature.properties?.dpto_cnmbr || "");
    const nice = nameByCode(code) || raw;
    const value = deptValue(aggregation, code, raw);
    const dept = DEPARTMENTS.find((d) => d.code === code);
    layer.bindPopup(
      `<strong>${nice}</strong><br/>Departamento (MGN DANE)<br/>Valor: ${value.toLocaleString("es-CO")}<br/><em>Clic para filtrar</em>`,
    );
    layer.on({
      click: () => {
        if (!dept) return;
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
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-ungrd-border bg-ungrd-bg text-sm text-ungrd-muted">
        Cargando mapa…
      </div>
    );
  }

  if (geoError || !geo) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm text-ungrd-danger">
        Error al cargar polígonos MGN: {geoError}
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-ungrd-border">
    <MapContainer
      key={`map-${selectedDepartment || "all"}`}
      center={[4.5, -74.1]}
      zoom={5.2}
      scrollWheelZoom={false}
      className="h-[240px] w-full sm:h-[360px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · polígonos <a href="https://geoportal.dane.gov.co/">MGN DANE 2024</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points.filter((p) => p.value > 0)} />

      {showChoropleth && (
        <GeoJSON
          key={`choropleth-${Object.keys(aggregation).join("|").slice(0, 80)}-${selectedName || ""}`}
          data={geo}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}

      {!showChoropleth &&
        points.map((p) => {
          const intensity = p.value / max;
          const radius = 8 + intensity * 22;
          const active = selectedName === p.name;
          return (
            <CircleMarker
              key={`${p.level}-${p.name}`}
              center={[p.lat, p.lng]}
              radius={active ? radius + 4 : radius}
              eventHandlers={{
                click: () => onSelect?.(p),
              }}
              pathOptions={{
                color: active ? "#ffd100" : "#002d5a",
                weight: active ? 3 : 1.5,
                fillColor: active ? "#ffe566" : "#ffd100",
                fillOpacity: active ? 0.95 : 0.25 + intensity * 0.65,
              }}
            >
              <Popup>
                <strong>{p.name}</strong>
                <br />
                Municipio (DIVIPOLA)
                <br />
                Valor: {p.value.toLocaleString("es-CO")}
                <br />
                <em>Clic para filtrar</em>
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
    </div>
  );
}
