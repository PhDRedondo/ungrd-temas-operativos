"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import type { NetworkEdge, NetworkNode, NetworkNodeType } from "@/lib/complexNetwork";

const TYPE_COLOR: Record<NetworkNodeType, string> = {
  departamento: "#002d5a",
  estado: "#5a6b7d",
  categoria: "#ffd100",
  municipio: "#0a3d6b",
};

type SimNode = NetworkNode &
  SimulationNodeDatum & {
    radius: number;
  };

type SimLink = {
  source: string | SimNode;
  target: string | SimNode;
  weight: number;
};

type Props = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function NetworkGraph({ nodes, edges, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [positions, setPositions] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(280, Math.floor(entry?.contentRect.width || 320));
      const h = w < 480 ? 340 : 440;
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxWeight = useMemo(
    () => Math.max(1, ...nodes.map((n) => n.weight)),
    [nodes],
  );

  useEffect(() => {
    if (!nodes.length) {
      setPositions([]);
      setLinks([]);
      return;
    }

    const simNodes: SimNode[] = nodes.map((n) => ({
      ...n,
      radius: 6 + (n.weight / maxWeight) * 14,
      x: size.w / 2 + (Math.random() - 0.5) * 80,
      y: size.h / 2 + (Math.random() - 0.5) * 80,
    }));
    const simLinks: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    const sim = forceSimulation(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => 70 - Math.min(40, l.weight * 2))
          .strength(0.35),
      )
      .force("charge", forceManyBody().strength(-220))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => d.radius + 4),
      )
      .on("tick", () => {
        setPositions(simNodes.map((n) => ({ ...n })));
        setLinks(simLinks.map((l) => ({ ...l })));
      });

    return () => {
      sim.stop();
    };
  }, [nodes, edges, size.w, size.h, maxWeight]);

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of edges) {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    }
    return set;
  }, [selectedId, edges]);

  const linkEnds = (l: SimLink) => {
    const s = typeof l.source === "string" ? positions.find((p) => p.id === l.source) : l.source;
    const t = typeof l.target === "string" ? positions.find((p) => p.id === l.target) : l.target;
    return { s, t };
  };

  return (
    <div ref={wrapRef} className="min-w-0 w-full max-w-full overflow-hidden">
      {!nodes.length ? (
        <p className="flex h-[340px] items-center justify-center text-sm text-ungrd-muted">
          Sin datos suficientes para construir la red.
        </p>
      ) : (
        <svg
          width="100%"
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="rounded-xl bg-[radial-gradient(ellipse_at_center,rgba(0,45,90,0.06),transparent_70%)]"
          role="img"
          aria-label="Grafo de red compleja"
          onClick={() => onSelect(null)}
        >
          {links.map((l, i) => {
            const { s, t } = linkEnds(l);
            if (!s?.x || !s?.y || !t?.x || !t?.y) return null;
            const sid = typeof l.source === "string" ? l.source : l.source.id;
            const tid = typeof l.target === "string" ? l.target : l.target.id;
            const dim =
              selectedId != null &&
              !neighborIds.has(sid) &&
              !neighborIds.has(tid);
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="#94a3b8"
                strokeOpacity={dim ? 0.08 : 0.35 + Math.min(0.4, l.weight * 0.05)}
                strokeWidth={1 + Math.min(4, l.weight * 0.35)}
              />
            );
          })}

          {positions.map((n) => {
            const active = selectedId === n.id;
            const dim = selectedId != null && !neighborIds.has(n.id);
            const fill =
              n.type === "categoria" ? "#ffd100" : TYPE_COLOR[n.type];
            const stroke =
              n.type === "categoria" ? "#002d5a" : active ? "#ffd100" : "#001a36";
            return (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                className="cursor-pointer"
                opacity={dim ? 0.2 : 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(active ? null : n.id);
                }}
              >
                <circle
                  r={n.radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={active ? 3 : 1.5}
                />
                <title>{`${n.label} (${n.type}) · peso ${n.weight}`}</title>
                {(active || n.radius > 12 || size.w > 520) && (
                  <text
                    y={n.radius + 11}
                    textAnchor="middle"
                    className="fill-ungrd-heading"
                    style={{ fontSize: size.w < 400 ? 8 : 10, fontWeight: 700 }}
                  >
                    {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export const NETWORK_TYPE_LABELS: Record<NetworkNodeType, string> = {
  departamento: "Departamento",
  estado: "Estado",
  categoria: "Categoría",
  municipio: "Municipio",
};

export const NETWORK_TYPE_COLORS = TYPE_COLOR;
