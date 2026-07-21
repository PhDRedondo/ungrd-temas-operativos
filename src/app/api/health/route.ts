import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { GEO_SOURCE } from "@/lib/geo";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      service: "ungrd-temas-operativos",
      authMode: process.env.AUTH_MODE || "demo",
      db: "up",
      geo: GEO_SOURCE,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : "db error",
      },
      { status: 503 },
    );
  }
}
