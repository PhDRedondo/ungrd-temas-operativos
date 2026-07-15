"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyGraph, type SankeyNode } from "d3-sankey";
import clsx from "clsx";

export type SankeyRecord = {
  departamento: string;
  estado: string;
  tercero: string;
};

type ExtraNode = {
  id: string;
  name: string;
  column: 0 | 1 | 2;
};

type ExtraLink = {
  source: string | number | SankeyNode<ExtraNode, ExtraLink>;
  target: string | number | SankeyNode<ExtraNode, ExtraLink>;
  value: number;
};

const LEFT_RIGHT_COLORS = [
  "#e85d04",
  "#f48c06",
  "#faa307",
  "#dc2f02",
  "#9d0208",
  "#e09f3e",
  "#c1121f",
  "#ffba08",
  "#ae2012",
  "#bb3e03",
  "#d00000",
  "#ff7b00",
  "#ff9e00",
  "#6a040f",
];

const MIDDLE_COLOR = "#374151";
const LINK_FILL = "rgba(156, 163, 175, 0.38)";
const LINK_HOVER = "rgba(107, 114, 128, 0.55)";

type Props = {
  records: SankeyRecord[];
  thirdLabel: string;
  onNodeClick?: (column: 0 | 1 | 2, name: string) => void;
  activeFilters?: { departamento?: string; estado?: string; tercero?: string };
};

function buildGraph(records: SankeyRecord[]) {
  const link12 = new Map<string, number>();
  const link23 = new Map<string, number>();
  const deptCount = new Map<string, number>();
  const terceroCount = new Map<string, number>();

  for (const r of records) {
    const d = r.departamento || "N/D";
    const e = r.estado || "N/D";
    const t = r.tercero || "N/D";
    deptCount.set(d, (deptCount.get(d) || 0) + 1);
    terceroCount.set(t, (terceroCount.get(t) || 0) + 1);
    link12.set(`${d}||${e}`, (link12.get(`${d}||${e}`) || 0) + 1);
    link23.set(`${e}||${t}`, (link23.get(`${e}||${t}`) || 0) + 1);
  }

  const depts = [...deptCount.keys()]
    .sort((a, b) => (deptCount.get(b) || 0) - (deptCount.get(a) || 0))
    .slice(0, 14);
  const terceros = [...terceroCount.keys()]
    .sort((a, b) => (terceroCount.get(b) || 0) - (terceroCount.get(a) || 0))
    .slice(0, 14);
  const deptSet = new Set(depts);
  const terceroSet = new Set(terceros);

  const used = new Set<string>();
  const links: ExtraLink[] = [];

  for (const [k, value] of link12) {
    const [d, e] = k.split("||");
    if (!d || !e || !deptSet.has(d)) continue;
    const source = `d:${d}`;
    const target = `e:${e}`;
    used.add(source);
    used.add(target);
    links.push({ source, target, value });
  }

  for (const [k, value] of link23) {
    const [e, t] = k.split("||");
    if (!e || !t || !terceroSet.has(t)) continue;
    // Only keep estados that already appear from dept→estado links
    if (!used.has(`e:${e}`)) continue;
    const source = `e:${e}`;
    const target = `t:${t}`;
    used.add(source);
    used.add(target);
    links.push({ source, target, value });
  }

  const nodes: ExtraNode[] = [...used].map((id) => {
    const [prefix, ...rest] = id.split(":");
    const name = rest.join(":");
    const column = (prefix === "d" ? 0 : prefix === "e" ? 1 : 2) as 0 | 1 | 2;
    return { id, name, column };
  });

  // Drop links pointing to nodes somehow missing (safety)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const safeLinks = links.filter(
    (l) =>
      typeof l.source === "string" &&
      typeof l.target === "string" &&
      nodeIds.has(l.source) &&
      nodeIds.has(l.target) &&
      l.value > 0,
  );

  return { nodes, links: safeLinks };
}

export function SankeyFlowDiagram({
  records,
  thirdLabel,
  onNodeClick,
  activeFilters,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 420 });
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.max(640, entry?.contentRect.width || 900);
      setSize({ w, h: Math.max(360, Math.min(520, w * 0.48)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const { nodes, links } = buildGraph(records);
    if (!nodes.length || !links.length) return null;

    try {
      const gen = sankey<ExtraNode, ExtraLink>()
        .nodeId((d) => d.id)
        .nodeWidth(14)
        .nodePadding(14)
        .extent([
          [110, 36],
          [size.w - 110, size.h - 16],
        ]);

      const graph = gen({
        nodes: nodes.map((n) => ({ ...n })),
        links: links.map((l) => ({ ...l })),
      }) as SankeyGraph<ExtraNode, ExtraLink>;

      const xs = [110, size.w / 2 - 7, size.w - 124];
      for (const node of graph.nodes) {
        const x0 = xs[node.column] ?? node.x0!;
        const w = (node.x1 ?? 0) - (node.x0 ?? 0);
        node.x0 = x0;
        node.x1 = x0 + w;
      }

      gen.update(graph);
      return graph;
    } catch {
      return null;
    }
  }, [records, size.w, size.h]);

  const path = sankeyLinkHorizontal();

  const colorFor = (node: SankeyNode<ExtraNode, ExtraLink>) => {
    if (node.column === 1) return MIDDLE_COLOR;
    let hash = 0;
    for (let i = 0; i < node.name.length; i++) {
      hash = (hash * 31 + node.name.charCodeAt(i)) >>> 0;
    }
    return LEFT_RIGHT_COLORS[hash % LEFT_RIGHT_COLORS.length]!;
  };

  const isActive = (node: ExtraNode) => {
    if (!activeFilters) return false;
    if (node.column === 0) return activeFilters.departamento === node.name;
    if (node.column === 1) return activeFilters.estado === node.name;
    return activeFilters.tercero === node.name;
  };

  return (
    <div ref={wrapRef} className="w-full">
      <div className="mb-1">
        <h3 className="text-base font-extrabold text-ungrd-heading">
          Flujo departamento → estado → {thirdLabel.toLowerCase()}
        </h3>
        <p className="mt-0.5 text-sm text-ungrd-muted">
          Clic en un nodo para filtrar cruzado. El grosor del flujo representa el
          número de registros.
        </p>
      </div>

      {!layout ? (
        <p className="py-16 text-center text-sm text-ungrd-muted">
          Sin datos suficientes para el diagrama de Sankey.
        </p>
      ) : (
        <svg
          width="100%"
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="select-none"
          role="img"
          aria-label="Diagrama de Sankey"
        >
          {/* Column headers */}
          {[
            { x: 117, label: "DEPARTAMENTO" },
            { x: size.w / 2, label: "ESTADO" },
            { x: size.w - 117, label: thirdLabel.toUpperCase() },
          ].map((h) => (
            <text
              key={h.label}
              x={h.x}
              y={18}
              textAnchor="middle"
              className="fill-ungrd-muted"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}
            >
              {h.label}
            </text>
          ))}

          {/* Links */}
          <g>
            {layout.links.map((link, i) => {
              const d = path(link as never);
              if (!d) return null;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={hoverLink === i ? LINK_HOVER : LINK_FILL}
                  strokeWidth={Math.max(1.5, link.width || 1)}
                  strokeOpacity={1}
                  className="transition-[stroke] duration-150"
                  onMouseEnter={() => setHoverLink(i)}
                  onMouseLeave={() => setHoverLink(null)}
                >
                  <title>
                    {`${(link.source as SankeyNode<ExtraNode, ExtraLink>).name} → ${(link.target as SankeyNode<ExtraNode, ExtraLink>).name}: ${link.value}`}
                  </title>
                </path>
              );
            })}
          </g>

          {/* Nodes + labels */}
          <g>
            {layout.nodes.map((node) => {
              const x0 = node.x0 ?? 0;
              const x1 = node.x1 ?? 0;
              const y0 = node.y0 ?? 0;
              const y1 = node.y1 ?? 0;
              const midY = (y0 + y1) / 2;
              const height = Math.max(2, y1 - y0);
              const active = isActive(node);
              const dimmed =
                hoverNode != null &&
                hoverNode !== node.id &&
                !layout.links.some((l) => {
                  const s = l.source as SankeyNode<ExtraNode, ExtraLink>;
                  const t = l.target as SankeyNode<ExtraNode, ExtraLink>;
                  return (
                    (s.id === hoverNode && t.id === node.id) ||
                    (t.id === hoverNode && s.id === node.id)
                  );
                });

              const labelLeft = node.column === 0;
              const labelRight = node.column === 2;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.35 : 1}
                  onMouseEnter={() => setHoverNode(node.id)}
                  onMouseLeave={() => setHoverNode(null)}
                  onClick={() => onNodeClick?.(node.column, node.name)}
                >
                  <rect
                    x={x0}
                    y={y0}
                    width={x1 - x0}
                    height={height}
                    fill={colorFor(node)}
                    rx={0}
                    className={clsx("transition-opacity")}
                    stroke={active ? "#ffd100" : "none"}
                    strokeWidth={active ? 2 : 0}
                  >
                    <title>{`${node.name}: ${node.value ?? 0}`}</title>
                  </rect>
                  <text
                    x={
                      labelLeft
                        ? x0 - 8
                        : labelRight
                          ? x1 + 8
                          : x1 + 10
                    }
                    y={midY}
                    dy="0.35em"
                    textAnchor={labelLeft ? "end" : "start"}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: "currentColor",
                    }}
                    className="fill-ungrd-heading"
                  >
                    {node.name.length > 18
                      ? `${node.name.slice(0, 16)}…`
                      : node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
