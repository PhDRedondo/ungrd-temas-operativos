/**
 * Higiene + backfill Agua en prod (admin).
 * - Soft-delete smoke/test
 * - Normaliza capas legacy → canónicas
 * - Backfill valor desde mapa OP→ValorOP (body)
 */
import { NextResponse } from "next/server";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { writeAudit } from "@/lib/records/repository";
import { syncAguaMaquetaFromLatest } from "@/themes/agua-y-saneamiento/maqueta-sync";

type Body = {
  valores?: { op: string; valor: number }[];
  syncMaqueta?: boolean;
};

export async function POST(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => ({}))) as Body;
  const report: Record<string, unknown> = {};

  const junk = await db.execute(dsql`
    UPDATE records
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE theme_id = 'agua-y-saneamiento'
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'orden_de_proveeduria','') ~* '(SMOKE-OP|MOKE-OP|TEST-OP|TEST-TABLAS|EST-TABLAS|TEST-VER|SMOOK)'
        OR COALESCE(payload->>'clave_seguimiento','') ~* '(SMOKE-OP|MOKE-OP|TEST-OP|TEST-TABLAS|EST-TABLAS|TEST-VER|SMOOK)'
        OR COALESCE(payload->>'objeto','') ~* '^smoke-'
      )
    RETURNING id
  `);
  report.junkSoftDeleted = Array.isArray(junk) ? junk.length : 0;

  const maqueta = await db.execute(dsql`
    UPDATE records
    SET payload = jsonb_set(
      jsonb_set(COALESCE(payload, '{}'::jsonb), '{tipo_registro}', '"Alta / orden"', true),
      '{capa}', '"Alta / orden"', true
    ),
    updated_at = NOW()
    WHERE theme_id = 'agua-y-saneamiento'
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'tipo_registro','') ILIKE 'Maqueta / orden'
        OR COALESCE(payload->>'capa','') ILIKE 'Maqueta / orden'
      )
    RETURNING id
  `);
  report.normalizedMaquetaToAlta = Array.isArray(maqueta) ? maqueta.length : 0;

  const bit = await db.execute(dsql`
    UPDATE records
    SET payload = jsonb_set(
      jsonb_set(COALESCE(payload, '{}'::jsonb), '{tipo_registro}', '"Bitácora estado"', true),
      '{capa}', '"Bitácora estado"', true
    ),
    updated_at = NOW()
    WHERE theme_id = 'agua-y-saneamiento'
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'tipo_registro','') = 'Bitácora'
        OR COALESCE(payload->>'capa','') = 'Bitácora'
      )
    RETURNING id
  `);
  report.normalizedBitacora = Array.isArray(bit) ? bit.length : 0;

  const plazo = await db.execute(dsql`
    UPDATE records
    SET payload = jsonb_set(
      jsonb_set(COALESCE(payload, '{}'::jsonb), '{tipo_registro}', '"Modificación contractual"', true),
      '{capa}', '"Modificación contractual"', true
    ),
    updated_at = NOW()
    WHERE theme_id = 'agua-y-saneamiento'
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'tipo_registro','') ILIKE '%plazo%forma%'
        OR COALESCE(payload->>'capa','') ILIKE '%plazo%forma%'
      )
    RETURNING id
  `);
  report.normalizedPlazoMod = Array.isArray(plazo) ? plazo.length : 0;

  let valorUpdated = 0;
  const opsForSync = new Set<string>();
  for (const item of body.valores || []) {
    const op = String(item.op || "").trim();
    const valor = Number(item.valor);
    if (!op || !Number.isFinite(valor) || valor === 0) continue;
    const res = await db.execute(dsql`
      UPDATE records
      SET
        valor = ${String(valor)},
        payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{valor}', to_jsonb(${valor}::numeric), true),
        updated_at = NOW()
      WHERE theme_id = 'agua-y-saneamiento'
        AND deleted_at IS NULL
        AND (
          COALESCE(payload->>'tipo_registro','') IN ('Alta / orden', 'Maqueta / orden')
          OR COALESCE(payload->>'capa','') IN ('Alta / orden', 'Maqueta / orden')
        )
        AND (
          lower(trim(COALESCE(payload->>'orden_de_proveeduria',''))) = ${op.toLowerCase()}
          OR lower(trim(COALESCE(payload->>'clave_seguimiento',''))) = ${op.toLowerCase()}
        )
        AND CAST(valor AS numeric) = 0
      RETURNING id
    `);
    const n = Array.isArray(res) ? res.length : 0;
    if (n > 0) {
      valorUpdated += n;
      opsForSync.add(op);
    }
  }
  report.valorBackfilledRows = valorUpdated;
  report.valorItemsReceived = (body.valores || []).length;

  let synced = 0;
  if (body.syncMaqueta) {
    let targets = [...opsForSync];
    if (!targets.length) {
      const opsRes = await db.execute(dsql`
        SELECT DISTINCT trim(COALESCE(payload->>'orden_de_proveeduria', payload->>'clave_seguimiento', '')) AS op
        FROM records
        WHERE theme_id = 'agua-y-saneamiento'
          AND deleted_at IS NULL
          AND COALESCE(payload->>'tipo_registro', payload->>'capa', '') = 'Alta / orden'
          AND trim(COALESCE(payload->>'orden_de_proveeduria', payload->>'clave_seguimiento', '')) <> ''
        LIMIT 400
      `);
      targets = (Array.isArray(opsRes) ? opsRes : []).map((r) =>
        String((r as { op: string }).op),
      );
    }
    for (const op of targets) {
      const r = await syncAguaMaquetaFromLatest({
        op,
        userId: authz.actor.userId,
        sourceCapa: "admin hygiene",
      });
      if (r.ok && (r.changedFields?.length || 0) > 0) synced += 1;
    }
  }
  report.maquetaSynced = synced;

  await writeAudit({
    userId: authz.actor.userId,
    action: "admin.agua_hygiene",
    entity: "records",
    entityId: "agua-y-saneamiento",
    after: report,
  });

  return NextResponse.json({ ok: true, report });
}
