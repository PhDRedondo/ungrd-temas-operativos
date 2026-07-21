/**
 * harness:security — headers, sonda bloqueada, protocolo activo
 */
import "dotenv/config";
import { assert, ok, req, section, type Jar, BASE } from "./lib";

async function main() {
  section(`Harness SECURITY · ${BASE}`);
  const jar: Jar = new Map();

  {
    const { res } = await req(jar, "/api/health");
    assert(res.ok, `health ${res.status}`);
    const proto = res.headers.get("x-ungrd-security");
    assert(proto === "protocol-v1", `header protocolo: ${proto}`);
    ok("X-UNGRD-Security: protocol-v1");
    assert(
      res.headers.get("x-content-type-options") === "nosniff",
      "falta nosniff",
    );
    ok("X-Content-Type-Options: nosniff");
    assert(res.headers.get("x-frame-options") === "DENY", "falta XFO");
    ok("X-Frame-Options: DENY");
  }

  {
    const { res, json } = await req(jar, "/wp-admin/login.php");
    assert(res.status === 400 || res.status === 403, `sonda status ${res.status}`);
    const code = (json as { code?: string })?.code;
    assert(
      code === "BAD_REQUEST" || code === "IP_BANNED" || code === "RATE_LIMITED",
      `código sonda: ${code}`,
    );
    ok(`sonda /wp-admin bloqueada → ${res.status} ${code}`);
  }

  {
    const { res, json } = await req(jar, "/api/themes/x/records?q=../../etc/passwd");
    // puede ser 400 (inspect) o 401 (auth) según orden; ambos OK si no 200 con data
    assert(
      [400, 401, 403, 429].includes(res.status),
      `traversal status ${res.status} ${JSON.stringify(json)}`,
    );
    ok(`path traversal / auth → ${res.status}`);
  }

  {
    const { res } = await req(jar, "/.env");
    assert([400, 403, 404, 429].includes(res.status), `.env → ${res.status}`);
    ok(`sonda /.env → ${res.status}`);
  }

  console.log("\n=== HARNESS SECURITY PASS ===\n");
}

main().catch((e) => {
  console.error("\n=== HARNESS SECURITY FAIL ===");
  console.error(e);
  console.error(`¿App en ${BASE}? → npm run dev`);
  process.exit(1);
});
