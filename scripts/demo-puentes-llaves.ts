/**
 * Demostración del seguimiento por llaves en Puentes (solo lectura).
 *
 * Recorre el mismo camino que la UI de captura de bitácora:
 *   facetas iniciales → filtro por origen → filtro por proceso → territorio
 *   → alias de búsqueda ("EEUU 3") → historial del puente elegido
 *
 * Uso: npx tsx scripts/demo-puentes-llaves.ts [baseUrl]
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const EMAIL = process.env.DEMO_AUTH_EMAIL || "admin@ungrd.gov.co";
const PASSWORD = process.env.DEMO_AUTH_PASSWORD || "UNGRD2026";

type Jar = Map<string, string>;

function parseSetCookie(headers: Headers, jar: Jar) {
  const raw =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair!.indexOf("=");
    if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
  }
}

async function req(jar: Jar, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (jar.size) {
    headers.set(
      "cookie",
      [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    );
  }
  const res = await fetch(BASE + path, { ...init, headers });
  parseSetCookie(res.headers, jar);
  return res;
}

async function login(jar: Jar) {
  const csrf = await (await req(jar, "/api/auth/csrf")).json();
  await req(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: "/app",
      json: "true",
    }),
    redirect: "manual",
  });
  const session = await (await req(jar, "/api/auth/session")).json();
  if (!session?.user?.email) throw new Error("Login falló");
  return session.user.email as string;
}

type Facet = { value: string; label: string; count: number };
type Hit = {
  id_puente: string;
  codigo_operativo: string;
  proceso_sigla: string;
  origen_adquisicion: string;
  tipo: string;
  configuracion: string;
  ubicacion_actual: string;
  departamento: string;
  municipio: string;
  estado_puente: string;
  longitud_m: number | string;
  eventos_bitacora?: number;
  puentes_en_proceso?: number;
  payload?: Record<string, string | number>;
};

async function search(jar: Jar, query: Record<string, string>) {
  const params = new URLSearchParams({
    capa: "Inventario puente",
    facets: "1",
    limit: "20",
    ...query,
  });
  const res = await req(jar, `/api/themes/puentes/puentes?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    count: number;
    puentes: Hit[];
    facets: {
      origenes: Facet[];
      procesos: Facet[];
      tipos: Facet[];
      configuraciones: Facet[];
      ubicaciones: Facet[];
      contratos: Facet[];
      matching: number;
      total: number;
    };
  };
}

function facetLine(list: Facet[]): string {
  if (!list.length) return "—";
  return list.map((f) => `${f.label} (${f.count})`).join(" · ");
}

function hitLine(h: Hit): string {
  const code = h.codigo_operativo || `ID ${h.id_puente}`;
  const loc = [h.ubicacion_actual, h.municipio, h.departamento]
    .filter(Boolean)
    .join(", ");
  const extras = [
    h.estado_puente,
    h.longitud_m ? `${h.longitud_m} m` : "",
    h.eventos_bitacora !== undefined ? `${h.eventos_bitacora} ev.` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `${code.padEnd(28)} id=${h.id_puente.padEnd(4)} ${loc} — ${extras}`;
}

function section(title: string) {
  console.log(`\n${"─".repeat(76)}\n${title}\n${"─".repeat(76)}`);
}

async function main() {
  const jar: Jar = new Map();
  const user = await login(jar);
  console.log(`Servidor: ${BASE} · sesión: ${user}`);

  section("PASO 1 · Sin filtros: qué opciones existen (nivel 1 del modelo)");
  const base = await search(jar, {});
  console.log(`Puentes en inventario: ${base.facets.total}`);
  console.log(`Origen:   ${facetLine(base.facets.origenes)}`);
  console.log(`Proceso:  ${facetLine(base.facets.procesos)}`);
  console.log(`Tipo:     ${facetLine(base.facets.tipos)}`);

  section("PASO 2 · Filtro por origen = Donación EEUU");
  const donacion = await search(jar, { origen: "donacion_eeuu" });
  console.log(`Coinciden: ${donacion.facets.matching} de ${donacion.facets.total}`);
  console.log(`Proceso disponible:  ${facetLine(donacion.facets.procesos)}`);
  console.log(`Configuración:       ${facetLine(donacion.facets.configuraciones)}`);
  console.log(`Ubicaciones:         ${facetLine(donacion.facets.ubicaciones)}`);
  console.log("\nPuentes de la donación:");
  for (const h of donacion.puentes) console.log(`  ${hitLine(h)}`);

  const procesoDonacion = donacion.facets.procesos[0]?.value || "";

  section("PASO 3 · Caso difícil: 5 puentes en la misma ubicación (Tolemaida)");
  const tolemaida = await search(jar, {
    origen: "donacion_eeuu",
    proceso: procesoDonacion,
    ubicacion: "Fuerte Militar Tolemaida",
  });
  console.log(
    `Coinciden: ${tolemaida.facets.matching} · el código operativo los distingue:`,
  );
  for (const h of tolemaida.puentes) console.log(`  ${hitLine(h)}`);

  section("PASO 4 · Búsqueda rápida por alias (el operador escribe distinto)");
  for (const term of ["EEUU 3", "DON-EEUU-03", "20", "eeuu-10", "Mendihuaca"]) {
    const r = await search(jar, { q: term });
    const shown = r.puentes
      .slice(0, 3)
      .map((h) => h.codigo_operativo || `ID ${h.id_puente}`)
      .join(", ");
    console.log(`  "${term}"`.padEnd(18) + `→ ${r.count} resultado(s): ${shown || "—"}`);
  }

  section("PASO 5 · Filtro por contrato nacional (el otro proceso)");
  const contrato = await search(jar, { origen: "contrato_nacional" });
  console.log(`Coinciden: ${contrato.facets.matching}`);
  console.log(`Proceso: ${facetLine(contrato.facets.procesos)}`);
  console.log("Primeros 5:");
  for (const h of contrato.puentes.slice(0, 5)) console.log(`  ${hitLine(h)}`);

  section("PASO 6 · Historial de bitácora (mismo ID = varios eventos, es correcto)");
  const conEventos = donacion.puentes
    .filter((h) => (h.eventos_bitacora || 0) > 1)
    .slice(0, 2);
  const objetivo = conEventos.length ? conEventos : donacion.puentes.slice(0, 1);
  for (const h of objetivo) {
    const params = new URLSearchParams({
      id: h.id_puente,
      capa: "Bitácora estado",
      all: "1",
    });
    const res = await req(jar, `/api/themes/puentes/puentes?${params}`);
    const data = (await res.json()) as { count: number; puentes: Hit[] };
    console.log(
      `\n${h.codigo_operativo || h.id_puente} (id_puente ${h.id_puente}) → ${data.count} evento(s):`,
    );
    for (const ev of data.puentes) {
      const p = ev.payload || {};
      const fecha =
        String(p.fecha_inicio || p.fecha_corte_reporte || p.fecha || "").slice(
          0,
          10,
        ) || "sin fecha";
      console.log(
        `  ${fecha.padEnd(11)} ${(ev.estado_puente || "—").padEnd(12)} ${
          ev.ubicacion_actual || "—"
        }`,
      );
    }
  }

  section("PASO 7 · Estructuración: se sigue por proceso, no por puente");
  const proc = await req(jar, "/api/themes/puentes/procesos?limit=10");
  const procData = (await proc.json()) as {
    procesos: {
      contrato_convenio: string;
      clave_proceso: string;
      tipo_vinculo: string;
      puentes_vinculados?: number;
    }[];
  };
  for (const p of procData.procesos) {
    console.log(
      `  ${p.tipo_vinculo.padEnd(10)} ${String(p.puentes_vinculados || 0).padStart(2)} puentes · ${p.contrato_convenio.slice(0, 52)}`,
    );
  }

  console.log("\n✓ Demostración completa (solo lectura, sin registros nuevos)\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
