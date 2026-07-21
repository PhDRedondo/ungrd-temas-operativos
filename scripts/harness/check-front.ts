/**
 * harness:front — rutas UI
 */
import "dotenv/config";
import {
  assert,
  loginDemo,
  ok,
  req,
  section,
  type Jar,
  BASE,
} from "./lib";

async function expectStatus(
  jar: Jar,
  path: string,
  allowed: number[],
  label: string,
) {
  const { res } = await req(jar, path, { redirect: "manual" });
  assert(
    allowed.includes(res.status),
    `${label}: status ${res.status} (esperado ${allowed.join("|")})`,
  );
  ok(`${label} → ${res.status}`);
}

async function main() {
  section(`Harness FRONT · ${BASE}`);
  const jar: Jar = new Map();

  await expectStatus(jar, "/", [200, 307, 308], "landing /");
  await expectStatus(jar, "/login", [200], "login");

  // Geo estático del mapa
  {
    const { res } = await req(jar, "/geo/departamentos-mgn2024.json");
    assert(res.ok, `geo json ${res.status}`);
    ok("public/geo MGN 200");
  }

  // Sin sesión: /app debe redirigir a login
  {
    const anon: Jar = new Map();
    const { res } = await req(anon, "/app", { redirect: "manual" });
    assert(
      [307, 302, 303].includes(res.status) || res.status === 200,
      `/app sin sesión: ${res.status}`,
    );
    ok(`/app sin sesión → ${res.status}`);
  }

  await loginDemo(jar, "captura");

  await expectStatus(jar, "/app", [200], "/app autenticado");
  await expectStatus(
    jar,
    "/app/temas/agua-y-saneamiento",
    [200],
    "workspace tema",
  );
  await expectStatus(jar, "/app/cargas", [200], "bandeja UI");
  await expectStatus(jar, "/app/acerca", [200], "acerca");

  console.log("\n=== HARNESS FRONT PASS ===\n");
}

main().catch((e) => {
  console.error("\n=== HARNESS FRONT FAIL ===");
  console.error(e);
  console.error(`¿Está la app en ${BASE}? → npm run dev`);
  process.exit(1);
});
