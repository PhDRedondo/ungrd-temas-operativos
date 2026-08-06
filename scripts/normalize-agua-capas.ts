/**
 * Normaliza capas legacy Agua en DB:
 *   Maqueta / orden → Alta / orden
 *   Seguimiento operativo → Bitácora estructuración
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  const themeId = "agua-y-saneamiento";

  const before = await db.execute(sql`
    select coalesce(payload->>'capa','') as capa,
           coalesce(payload->>'tipo_registro','') as tipo,
           count(*)::int as n
    from records
    where theme_id = ${themeId} and deleted_at is null
    group by 1,2 order by n desc
  `);
  console.log("ANTES:", before);

  const r1 = await db.execute(sql`
    update records
    set payload = jsonb_set(
      jsonb_set(
        coalesce(payload, '{}'::jsonb),
        '{capa}',
        '"Alta / orden"'
      ),
      '{tipo_registro}',
      '"Alta / orden"'
    ),
    updated_at = now()
    where theme_id = ${themeId}
      and deleted_at is null
      and (
        coalesce(payload->>'capa','') = 'Maqueta / orden'
        or coalesce(payload->>'tipo_registro','') = 'Maqueta / orden'
      )
  `);
  console.log("Maqueta → Alta:", r1);

  const r2 = await db.execute(sql`
    update records
    set payload = jsonb_set(
      jsonb_set(
        coalesce(payload, '{}'::jsonb),
        '{capa}',
        '"Bitácora estructuración"'
      ),
      '{tipo_registro}',
      '"Bitácora estructuración"'
    ),
    updated_at = now()
    where theme_id = ${themeId}
      and deleted_at is null
      and (
        coalesce(payload->>'capa','') = 'Seguimiento operativo'
        or coalesce(payload->>'tipo_registro','') = 'Seguimiento operativo'
      )
  `);
  console.log("Seguimiento → Bitácora estructuración:", r2);

  const after = await db.execute(sql`
    select coalesce(payload->>'capa','') as capa,
           coalesce(payload->>'tipo_registro','') as tipo,
           count(*)::int as n
    from records
    where theme_id = ${themeId} and deleted_at is null
    group by 1,2 order by n desc
  `);
  console.log("DESPUÉS:", after);

  const sample = await db.execute(sql`
    select coalesce(payload->>'orden_de_proveeduria', payload->>'clave_seguimiento','') as op
    from records
    where theme_id = ${themeId} and deleted_at is null
      and coalesce(payload->>'capa','') = 'Alta / orden'
    order by created_at desc
    limit 8
  `);
  console.log("Sample Alta OPs:", sample);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
