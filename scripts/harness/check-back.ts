/**
 * harness:back — APIs críticas
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

const THEME = "agua-y-saneamiento";

async function main() {
  section(`Harness BACK · ${BASE}`);
  const jar: Jar = new Map();

  {
    const { res, json } = await req(jar, "/api/health");
    assert(res.ok, `health ${res.status}`);
    const j = json as {
      ok: boolean;
      db: string;
      geo?: { countMunicipalities: number };
    };
    assert(j.ok && j.db === "up", "db down");
    assert((j.geo?.countMunicipalities || 0) >= 1000, "DIVIPOLA incomplete");
    ok(`health · db=up · munis=${j.geo!.countMunicipalities}`);
  }

  {
    const user = await loginDemo(jar, "captura");
    ok(`login demo · ${user.email} · ${user.role}`);
  }

  {
    const { res, json } = await req(jar, "/api/me/access");
    assert(res.ok, `me/access ${res.status}`);
    const themes = (json as { themes: unknown[] }).themes;
    assert(themes.length > 0, "sin temas ACL");
    ok(`me/access · ${themes.length} temas`);
  }

  {
    const { res, json } = await req(jar, `/api/themes/${THEME}/records`);
    assert(res.ok, `records ${res.status}`);
    const count = (json as { count: number }).count;
    ok(`records ${THEME} · ${count}`);
  }

  {
    const { res, json } = await req(jar, `/api/themes/${THEME}/analytics`);
    assert(res.ok, `analytics ${res.status}`);
    const j = json as { totals: { count: number }; byDepartamento: unknown[] };
    assert(Array.isArray(j.byDepartamento), "analytics shape");
    ok(`analytics SQL · deptos=${j.byDepartamento.length}`);
  }

  {
    const { res } = await req(jar, `/api/themes/${THEME}/template`);
    assert(res.ok, `template ${res.status}`);
    ok("template Excel disponible");
  }

  {
    const { res, json } = await req(jar, `/api/uploads?themeId=${THEME}`);
    assert(res.ok, `uploads ${res.status}`);
    ok(`bandeja · ${((json as { uploads: unknown[] }).uploads || []).length} cargas`);
  }

  console.log("\n=== HARNESS BACK PASS ===\n");
}

main().catch((e) => {
  console.error("\n=== HARNESS BACK FAIL ===");
  console.error(e);
  console.error(`¿Está la app en ${BASE}? → npm run dev`);
  process.exit(1);
});
