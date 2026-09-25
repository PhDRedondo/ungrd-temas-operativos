import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireThemeRead } from "@/lib/auth/session";

export async function GET() {
  const authz = await requireThemeRead("ejecucion-financiera");
  if (!authz.ok) return authz.response;

  try {
    const result = await db.execute(sql`
      select
        id::text as id,
        theme_id,
        origen,
        modalidad,
        linea,
        clave,
        detalle,
        departamento,
        municipio,
        estado,
        valor::text as valor,
        fecha::text as fecha,
        resolucion,
        pestana
      from medallion.v_manejo_consolidado
      order by fecha desc nulls last, clave
      limit 8000
    `);
    const rows = Array.isArray(result) ? result : result.rows;
    return NextResponse.json({ rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo leer el consolidado";
    return NextResponse.json(
      {
        error: message,
        hint: "Aplique sql/medallion/012_manejo_consolidado.sql en el Postgres de Manejo.",
      },
      { status: 503 },
    );
  }
}
