import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { GEO_SOURCE } from "@/lib/geo";

function databaseProbe() {
  const raw = process.env.DATABASE_URL || "";
  if (!raw.trim()) {
    return {
      configured: false,
      host: null as string | null,
      user: null as string | null,
      port: null as string | null,
      hint: "DATABASE_URL vacío en este entorno Vercel",
    };
  }
  try {
    const u = new URL(raw.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
    const user = u.username || null;
    const host = u.hostname || null;
    const port = u.port || "5432";
    const hints: string[] = [];
    if (host?.startsWith("db.") && host.includes("supabase.co")) {
      hints.push(
        "Host directo db.*.supabase.co suele ser solo IPv6; en Vercel use el pooler aws-*-pooler.supabase.com",
      );
    }
    if (user === "postgres" && host?.includes("pooler.supabase.com")) {
      hints.push(
        "En pooler el usuario debe ser postgres.<PROJECT_REF> (ej. postgres.vbxvqctdemtnmkifrxeo)",
      );
    }
    if (user?.startsWith("medallion_reader")) {
      hints.push(
        "medallion_reader es solo lectura para el lake; la app necesita postgres.<ref>",
      );
    }
    if (!u.password) {
      hints.push("La URL no trae password (¿se cortó al pegar?)");
    }
    return {
      configured: true,
      host,
      user,
      port,
      hint: hints.join(" · ") || null,
    };
  } catch {
    return {
      configured: true,
      host: null,
      user: null,
      port: null,
      hint: "DATABASE_URL no es una URI válida",
    };
  }
}

export async function GET() {
  const probe = databaseProbe();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      service: "ungrd-temas-operativos",
      authMode: process.env.AUTH_MODE || "demo",
      db: "up",
      database: probe,
      geo: GEO_SOURCE,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "db error";
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        database: probe,
        error: msg,
        fix: "Vercel → Settings → Environment Variables → DATABASE_URL (Production) = pooler Session, luego Redeploy",
        example:
          "postgresql://postgres.vbxvqctdemtnmkifrxeo:PASSWORD@aws-1-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require",
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
