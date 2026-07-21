/**
 * harness:platform — API v1 casos/tareas (piloto carrotanque)
 */
import "dotenv/config";
import { assert, loginDemo, ok, req, section, type Jar } from "./lib";

async function main() {
  section("Harness PLATFORM · /api/v1");
  const jar: Jar = new Map();

  await loginDemo(jar, "captura");
  ok("login captura");

  let caseId: string;

  {
    const { res, json } = await req(jar, "/api/v1/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseType: "ASSET_REGISTRATION",
        moduleId: "carrotanques",
        title: "Harness CT piloto",
        payload: {
          placa: "HARNESS-001",
          tipo: "Carrotanque",
          modalidad: "Comodato",
          instrumento: "COM-HARNESS-001",
          ubicacion: "La Guajira",
        },
      }),
    });
    assert(res.status === 201, `create case ${res.status}`);
    caseId = (json as { case: { id: string } }).case.id;
    ok(`caso creado · ${caseId.slice(0, 8)}…`);
  }

  {
    const { res } = await req(jar, `/api/v1/cases/${caseId}/submit`, {
      method: "POST",
    });
    assert(res.ok, `submit ${res.status}`);
    ok("caso enviado → versión FROZEN");
  }

  {
    const { res, json } = await req(jar, `/api/v1/cases/${caseId}`);
    assert(res.ok, `get case ${res.status}`);
    const j = json as { case: { status: string }; versions: unknown[] };
    assert(j.case.status === "UNDER_REVIEW", `status=${j.case.status}`);
    assert((j.versions || []).length >= 1, "sin versiones");
    ok(`detalle · status=${j.case.status} · versions=${j.versions.length}`);
  }

  {
    const { res, json } = await req(jar, "/api/v1/me/tasks");
    assert(res.ok, `tasks captura ${res.status}`);
    const tasks = (json as { tasks: unknown[] }).tasks || [];
    ok(`tareas captura · ${tasks.length} (esperado 0 tras envío)`);
  }

  await loginDemo(jar, "analista");
  ok("login analista");

  {
    const { res, json } = await req(jar, "/api/v1/me/tasks");
    assert(res.ok, `tasks analista ${res.status}`);
    const tasks = (json as { tasks: { id: string; stepCode: string }[] }).tasks;
    assert(tasks.length >= 1, "analista sin tareas de revisión");
    const tech = tasks.find((t) => t.stepCode === "TECH_REVIEW");
    assert(tech, "falta TECH_REVIEW");
    const { res: r2 } = await req(jar, `/api/v1/tasks/${tech!.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", comment: "OK harness" }),
    });
    assert(r2.ok, `approve tech ${r2.status}`);
    ok("revisión técnica aprobada");
  }

  console.log("\n=== HARNESS PLATFORM PASS ===\n");
}

main().catch((e) => {
  console.error("\n=== HARNESS PLATFORM FAIL ===");
  console.error(e);
  process.exit(1);
});
