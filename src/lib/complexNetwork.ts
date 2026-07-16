import type { RecordRow } from "@/lib/data";
import type { ThemeConfig } from "@/lib/themes";

export type NetworkNodeType = "departamento" | "estado" | "categoria" | "municipio";

export type NetworkNode = {
  id: string;
  label: string;
  type: NetworkNodeType;
  weight: number;
};

export type NetworkEdge = {
  source: string;
  target: string;
  weight: number;
};

export type NodeMetrics = {
  id: string;
  label: string;
  type: NetworkNodeType;
  degree: number;
  strength: number;
  degreeCentrality: number;
  betweenness: number;
  clustering: number;
};

export type NetworkMetrics = {
  nodes: number;
  edges: number;
  density: number;
  avgDegree: number;
  maxDegree: number;
  avgClustering: number;
  components: number;
  giantComponentShare: number;
  avgPathLength: number | null;
  diameter: number | null;
  nodeMetrics: NodeMetrics[];
};

export type ComplexNetwork = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metrics: NetworkMetrics;
  categoryLabel: string;
};

function adjList(nodes: NetworkNode[], edges: NetworkEdge[]) {
  const map = new Map<string, Map<string, number>>();
  for (const n of nodes) map.set(n.id, new Map());
  for (const e of edges) {
    map.get(e.source)?.set(e.target, e.weight);
    map.get(e.target)?.set(e.source, e.weight);
  }
  return map;
}

function connectedComponents(ids: string[], adj: Map<string, Map<string, number>>) {
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id];
    const comp: string[] = [];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur)?.keys() || []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/** Brandes betweenness (undirected), normalized by 1/((n-1)(n-2)). */
function betweennessCentrality(
  ids: string[],
  adj: Map<string, Map<string, number>>,
): Map<string, number> {
  const cb = new Map<string, number>();
  for (const id of ids) cb.set(id, 0);
  const n = ids.length;
  if (n < 3) return cb;

  for (const s of ids) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const v of ids) {
      pred.set(v, []);
      sigma.set(v, 0);
      dist.set(v, -1);
    }
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue = [s];
    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v)?.keys() || []) {
        if ((dist.get(w) ?? -1) < 0) {
          dist.set(w, (dist.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) || 0) + (sigma.get(v) || 0));
          pred.get(w)!.push(v);
        }
      }
    }
    const delta = new Map<string, number>();
    for (const v of ids) delta.set(v, 0);
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) || []) {
        const add =
          ((sigma.get(v) || 0) / (sigma.get(w) || 1)) * (1 + (delta.get(w) || 0));
        delta.set(v, (delta.get(v) || 0) + add);
      }
      if (w !== s) cb.set(w, (cb.get(w) || 0) + (delta.get(w) || 0));
    }
  }

  const norm = 1 / ((n - 1) * (n - 2));
  for (const id of ids) cb.set(id, (cb.get(id) || 0) * norm);
  return cb;
}

function localClustering(id: string, adj: Map<string, Map<string, number>>) {
  const neighbors = [...(adj.get(id)?.keys() || [])];
  const k = neighbors.length;
  if (k < 2) return 0;
  let triangles = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const a = neighbors[i]!;
      const b = neighbors[j]!;
      if (adj.get(a)?.has(b)) triangles += 1;
    }
  }
  return (2 * triangles) / (k * (k - 1));
}

/** BFS average path length + diameter on the giant component. */
function pathStats(comp: string[], adj: Map<string, Map<string, number>>) {
  if (comp.length < 2) return { avg: null as number | null, diameter: null as number | null };
  let sum = 0;
  let pairs = 0;
  let diameter = 0;
  for (const s of comp) {
    const dist = new Map<string, number>([[s, 0]]);
    const q = [s];
    while (q.length) {
      const v = q.shift()!;
      for (const w of adj.get(v)?.keys() || []) {
        if (!dist.has(w) && comp.includes(w)) {
          const d = (dist.get(v) || 0) + 1;
          dist.set(w, d);
          q.push(w);
        }
      }
    }
    for (const [t, d] of dist) {
      if (t === s) continue;
      sum += d;
      pairs += 1;
      if (d > diameter) diameter = d;
    }
  }
  return {
    avg: pairs ? sum / pairs : null,
    diameter: pairs ? diameter : null,
  };
}

/**
 * Red operativa multipartite:
 * Departamento ↔ Municipio ↔ Estado ↔ Categoría
 * (aristas ponderadas por co-ocurrencia en registros).
 */
export function buildComplexNetwork(
  records: RecordRow[],
  theme: ThemeConfig,
): ComplexNetwork {
  const categoryField = theme.fields.find(
    (f) =>
      f.type === "select" &&
      !["departamento", "estado"].includes(f.name),
  );
  const categoryKey = categoryField?.name || "municipio";
  const categoryLabel = categoryField?.label || "Municipio";
  const categoryType: NetworkNodeType = categoryField ? "categoria" : "municipio";

  const nodeMap = new Map<string, NetworkNode>();
  const edgeMap = new Map<string, number>();

  const bumpNode = (id: string, label: string, type: NetworkNodeType) => {
    const prev = nodeMap.get(id);
    if (prev) prev.weight += 1;
    else nodeMap.set(id, { id, label, type, weight: 1 });
  };

  const bumpEdge = (a: string, b: string) => {
    if (a === b) return;
    const [s, t] = a < b ? [a, b] : [b, a];
    const key = `${s}||${t}`;
    edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
  };

  // Cap municipios to keep graph readable
  const muniCount = new Map<string, number>();
  for (const r of records) {
    const m = String(r.municipio || "N/D");
    muniCount.set(m, (muniCount.get(m) || 0) + 1);
  }
  const topMunis = new Set(
    [...muniCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([m]) => m),
  );

  for (const r of records) {
    const dept = String(r.departamento || "N/D");
    const muni = String(r.municipio || "N/D");
    const estado = String(r.estado || "N/D");
    const cat = String(r[categoryKey] || "N/D");

    const dId = `d:${dept}`;
    const eId = `e:${estado}`;
    const cId = `c:${cat}`;
    const mId = `m:${muni}`;

    bumpNode(dId, dept, "departamento");
    bumpNode(eId, estado, "estado");
    bumpNode(cId, cat, categoryType);

    bumpEdge(dId, eId);
    bumpEdge(eId, cId);
    bumpEdge(dId, cId);

    if (topMunis.has(muni)) {
      bumpNode(mId, muni, "municipio");
      bumpEdge(dId, mId);
      bumpEdge(mId, eId);
    }
  }

  let nodes = [...nodeMap.values()];
  let edges = [...edgeMap.entries()].map(([key, weight]) => {
    const [source, target] = key.split("||") as [string, string];
    return { source, target, weight };
  });

  // Keep strongest edges if graph is huge
  if (edges.length > 120) {
    edges = edges.sort((a, b) => b.weight - a.weight).slice(0, 120);
    const used = new Set<string>();
    for (const e of edges) {
      used.add(e.source);
      used.add(e.target);
    }
    nodes = nodes.filter((n) => used.has(n.id));
  }

  const ids = nodes.map((n) => n.id);
  const adj = adjList(nodes, edges);
  const n = nodes.length;
  const m = edges.length;
  const density = n > 1 ? (2 * m) / (n * (n - 1)) : 0;

  const degrees = new Map<string, number>();
  const strengths = new Map<string, number>();
  for (const id of ids) {
    const neighbors = adj.get(id);
    degrees.set(id, neighbors?.size || 0);
    let s = 0;
    for (const w of neighbors?.values() || []) s += w;
    strengths.set(id, s);
  }

  const maxDeg = Math.max(0, ...degrees.values());
  const avgDegree = n ? [...degrees.values()].reduce((a, b) => a + b, 0) / n : 0;
  const bet = betweennessCentrality(ids, adj);

  const clusterings = new Map<string, number>();
  let clusterSum = 0;
  for (const id of ids) {
    const c = localClustering(id, adj);
    clusterings.set(id, c);
    clusterSum += c;
  }
  const avgClustering = n ? clusterSum / n : 0;

  const comps = connectedComponents(ids, adj);
  const giant = comps.sort((a, b) => b.length - a.length)[0] || [];
  const paths = pathStats(giant, adj);

  const nodeMetrics: NodeMetrics[] = nodes
    .map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      degree: degrees.get(node.id) || 0,
      strength: strengths.get(node.id) || 0,
      degreeCentrality: maxDeg ? (degrees.get(node.id) || 0) / maxDeg : 0,
      betweenness: bet.get(node.id) || 0,
      clustering: clusterings.get(node.id) || 0,
    }))
    .sort((a, b) => b.degree - a.degree || b.betweenness - a.betweenness);

  return {
    nodes,
    edges,
    categoryLabel,
    metrics: {
      nodes: n,
      edges: m,
      density,
      avgDegree,
      maxDegree: maxDeg,
      avgClustering,
      components: comps.length,
      giantComponentShare: n ? giant.length / n : 0,
      avgPathLength: paths.avg,
      diameter: paths.diameter,
      nodeMetrics,
    },
  };
}
