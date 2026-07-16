"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { DEPARTMENTS } from "@/lib/geo";

export type MapPoint = {
  name: string;
  lat: number;
  lng: number;
  value: number;
  level: "departamento" | "municipio";
};

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
  useEffect(() => setMounted(true), []);

  const points = useMemo(() => {
    if (selectedDepartment) {
      const dept = DEPARTMENTS.find((d) => d.name === selectedDepartment);
      if (!dept) return [] as MapPoint[];
      return dept.municipalities.map((m) => ({
        name: m.name,
        lat: m.lat,
        lng: m.lng,
        value: aggregation[m.name] || 0,
        level: "municipio" as const,
      }));
    }
    return DEPARTMENTS.map((d) => ({
      name: d.name,
      lat: d.lat,
      lng: d.lng,
      value: aggregation[d.name] || 0,
      level: "departamento" as const,
    }));
  }, [aggregation, selectedDepartment]);

  const max = Math.max(...points.map((p) => p.value), 1);

  if (!mounted) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-ungrd-border bg-ungrd-bg text-sm text-ungrd-muted sm:h-[360px]">
        Cargando mapa…
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-ungrd-border">
      <MapContainer
        center={[4.5, -74.1]}
        zoom={5.2}
        scrollWheelZoom={false}
        className="h-[240px] w-full sm:h-[360px]"
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points.filter((p) => p.value > 0)} />
      {points.map((p) => {
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
              {p.level === "departamento" ? "Departamento" : "Municipio"}
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
