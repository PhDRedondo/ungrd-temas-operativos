/**
 * Smoke test local: auth demo → records → analytics → template → upload.
 * Uso: npm run smoke
 */
import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import ExcelJS from "exceljs";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3000";
const THEME = "agua-y-saneamiento";
const WORK =
  process.env.SMOKE_DIR || path.join(os.tmpdir(), "ungrd-smoke");

type Jar = Map<string, string>;

function parseSetCookie(headers: Headers, jar: Jar) {
  const raw =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair!.indexOf("=");
    if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
  }
  if (raw.length === 0) {
    const single = headers.get("set-cookie");
    if (single) {
      const [pair] = single.split(";");
      const eq = pair!.indexOf("=");
      if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
    }
  }
}

function cookieHeader(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(
  jar: Jar,
  urlPath: string,
  init: RequestInit = {},
): Promise<{ res: Response; json?: unknown; buf?: ArrayBuffer }> {
  const headers = new Headers(init.headers || {});
  if (jar.size) headers.set("cookie", cookieHeader(jar));
  const res = await fetch(`${BASE}${urlPath}`, { ...init, headers });
  parseSetCookie(res.headers, jar);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return { res, json: await res.json() };
  }
  if (
    ct.includes("spreadsheet") ||
    ct.includes("octet-stream") ||
    urlPath.includes("template")
  ) {
    return { res, buf: await res.arrayBuffer() };
  }
  return { res };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  mkdirSync(WORK, { recursive: true });
  const jar: Jar = new Map();
  const log: string[] = [];
  const step = (s: string) => {
    log.push(s);
    console.log("✓", s);
  };

  {
    const { res, json } = await req(jar, "/api/health");
    assert(res.ok, `health ${res.status}`);
    const j = json as {
      ok: boolean;
      db: string;
      geo?: { countMunicipalities: number };
    };
    assert(j.ok && j.db === "up", "db down");
    assert((j.geo?.countMunicipalities || 0) >= 1000, "DIVIPOLA missing");
    step(`Health OK · DIVIPOLA ${j.geo!.countMunicipalities} munis`);
  }

  {
    const { res, json } = await req(jar, "/api/auth/csrf");
    assert(res.ok, "csrf");
    const csrf = (json as { csrfToken: string }).csrfToken;
    const body = new URLSearchParams({
      csrfToken: csrf,
      email: "smoke@ungrd.gov.co",
      password: "ungrd2026",
      role: "operativo",
      callbackUrl: "/app",
      json: "true",
    });
    await req(jar, "/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "manual",
    } as RequestInit);

    const session = await req(jar, "/api/auth/session");
    const user = (session.json as { user?: { email?: string; role?: string } })
      ?.user;
    assert(
      user?.email,
      `sesión no establecida: ${JSON.stringify(session.json)}`,
    );
    step(`Login OK · ${user!.email} · rol ${user!.role}`);
  }

  let before = 0;
  {
    const access = await req(jar, "/api/me/access");
    assert(access.res.ok, "me/access");
    const themes = (access.json as { themes: unknown[] }).themes;
    assert(themes.length > 0, "sin temas");
    const rec = await req(jar, `/api/themes/${THEME}/records`);
    assert(rec.res.ok, `records ${rec.res.status} ${JSON.stringify(rec.json)}`);
    before = (rec.json as { count: number }).count;
    step(`Records ${THEME}: ${before}`);
  }

  {
    const { res, json } = await req(jar, `/api/themes/${THEME}/analytics`);
    assert(res.ok, `analytics ${res.status}`);
    const j = json as {
      totals: { count: number };
      byDepartamento: unknown[];
    };
    assert(j.totals.count === before, "analytics count mismatch");
    assert(j.byDepartamento.length > 0, "sin agregación dept");
    step(`Analytics SQL OK · ${j.byDepartamento.length} departamentos`);
  }

  const tmp = path.join(WORK, `_smoke_template_${THEME}.xlsx`);
  {
    const { res, buf } = await req(jar, `/api/themes/${THEME}/template`);
    assert(res.ok && buf && buf.byteLength > 1000, "template");
    writeFileSync(tmp, Buffer.from(buf!));
    step(`Plantilla OK · ${buf!.byteLength} bytes`);
  }

  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(tmp);
    const sheet =
      wb.worksheets.find(
        (ws) =>
          !["_meta", "_catalogos", "_listas", "Instrucciones"].includes(
            ws.name,
          ),
      ) || wb.worksheets[0]!;

    const stamp = Date.now();
    const headers: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => {
      headers[col] = String(cell.value || "");
    });

    function writeRow(
      rowNum: number,
      values: Record<string, string | number>,
    ) {
      const row = sheet.getRow(rowNum);
      headers.forEach((h, col) => {
        if (!h) return;
        row.getCell(col).value = values[h] ?? "";
      });
      row.commit();
    }

    const opA = `SMOKE-OP-${stamp}-A`;
    const opB = `SMOKE-OP-${stamp}-B`;
    writeRow(2, {
      tipo_registro: "Alta / orden",
      capa: "Alta / orden",
      orden_de_proveeduria: opA,
      clave_seguimiento: opA,
      departamento: "Antioquia",
      municipio: "Medellín",
      fecha: "2026-07-15",
      estado: "Programado",
      valor: 1_500_000 + (stamp % 1000),
      proveedor: "Smoke Proveedor A",
      objeto: `smoke-${stamp}-a`,
    });
    writeRow(3, {
      tipo_registro: "Alta / orden",
      capa: "Alta / orden",
      orden_de_proveeduria: opB,
      clave_seguimiento: opB,
      departamento: "Antioquia",
      municipio: "Bello",
      fecha: "2026-07-16",
      estado: "En ejecución",
      valor: 2_500_000 + (stamp % 1000),
      proveedor: "Smoke Proveedor B",
      objeto: `smoke-${stamp}-b`,
    });
    // Fila inválida: sin tipo_registro/capa ni OP
    writeRow(4, {
      departamento: "Antioquia",
      municipio: "Medellín",
      valor: 100,
      objeto: `smoke-bad-${stamp}`,
    });

    const uploadPath = path.join(WORK, `_smoke_upload_${stamp}.xlsx`);
    await wb.xlsx.writeFile(uploadPath);
    const fileBuf = readFileSync(uploadPath);
    const form = new FormData();
    form.append(
      "file",
      new Blob([fileBuf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      path.basename(uploadPath),
    );
    form.append("mode", "upsert");

    const up = await req(jar, `/api/themes/${THEME}/uploads`, {
      method: "POST",
      body: form,
    });
    assert(up.res.ok, `upload ${up.res.status} ${JSON.stringify(up.json)}`);
    const u = up.json as {
      accepted: number;
      rejected: number;
      duplicates: number;
      uploadId: string;
      inserted?: number;
    };
    assert(u.accepted >= 2, `expected ≥2 accepted, got ${u.accepted}`);
    assert(u.rejected >= 1, `expected ≥1 rejected, got ${u.rejected}`);
    step(
      `Upload OK · accepted=${u.accepted} rejected=${u.rejected} dup=${u.duplicates} id=${u.uploadId}`,
    );

    // Multi-formulario: bitácora append sobre la misma OP
    const bit = await req(jar, `/api/themes/${THEME}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId: "bitacora",
        mode: "append",
        values: {
          orden_de_proveeduria: opA,
          fecha_estado: "2026-07-20",
          estado_macro: "Expediente",
          estado: "En ejecución",
          proceso: "En revisión",
          dependencia: "Técnico",
          comentario: `smoke-bitacora-${stamp}`,
        },
      }),
    });
    assert(bit.res.ok, `bitacora form ${bit.res.status} ${JSON.stringify(bit.json)}`);
    step(`Multi-form bitácora OK · OP ${opA}`);
  }

  {
    const rec = await req(jar, `/api/themes/${THEME}/records`);
    const after = (rec.json as { count: number }).count;
    assert(after >= before + 2, `count ${before} → ${after}`);
    step(`Records after upload: ${after} (+${after - before})`);
  }

  {
    const { res, json } = await req(jar, `/api/uploads?themeId=${THEME}`);
    assert(res.ok, "uploads list");
    const uploads = (json as { uploads: unknown[] }).uploads;
    assert(uploads.length > 0, "bandeja vacía");
    step(`Bandeja OK · ${uploads.length} cargas`);
  }

  console.log("\n=== SMOKE LOCAL PASS ===");
  for (const l of log) console.log(" -", l);
}

main().catch((err) => {
  console.error("\n=== SMOKE FAIL ===");
  console.error(err);
  process.exit(1);
});
