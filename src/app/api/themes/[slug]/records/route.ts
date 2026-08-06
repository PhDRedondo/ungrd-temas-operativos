import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead, requireThemeWrite } from "@/lib/auth/session";
import {
  getRecordsForTheme,
  insertValidatedRecords,
  upsertThemeCatalog,
  writeAudit,
} from "@/lib/records/repository";
import { validateRow } from "@/lib/validation/record-schema";
import { prepareTrackingRow } from "@/lib/uploads/capa-inference";
import {
  classifyForUpsert,
  upsertValidatedRecords,
} from "@/lib/uploads/process-excel";
import { syncAguaMaquetaFromLatest } from "@/themes/agua-y-saneamiento/maqueta-sync";
import { syncPuenteInventarioFromLatest } from "@/themes/puentes/puente-sync";
import { enforceProcesoChain } from "@/themes/puentes/proceso-chain";

type Ctx = { params: Promise<{ slug: string }> };

type PostBody = {
  values?: Record<string, unknown>;
  /** append = insertar siempre; upsert = actualizar por clave+capa; create-once = insertar o 409 si ya existe esa capa */
  mode?: "append" | "upsert" | "create-once";
  formId?: string;
};

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const rows = await getRecordsForTheme(theme.id);
  return NextResponse.json({
    themeId: theme.id,
    count: rows.length,
    records: rows,
    access: authz.access,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  await upsertThemeCatalog(theme);

  const body = (await req.json()) as PostBody;
  const mode = body.mode || "append";
  let prepared = prepareTrackingRow(theme, body.values || {});

  // Si viene de un captureForm, forzar capa del formulario
  if (body.formId && theme.captureForms?.length) {
    const form = theme.captureForms.find((f) => f.id === body.formId);
    if (form) {
      prepared.tipo_registro = form.capa;
      prepared.capa = form.capa;
    }
  }

  // Puentes: el contrato solo nace en Estructuración; las capas hijas lo heredan.
  if (theme.id === "puentes") {
    const chain = await enforceProcesoChain(prepared);
    if (!chain.ok) {
      return NextResponse.json({ error: chain.error }, { status: 400 });
    }
    prepared = chain.values;
  }

  const result = validateRow(theme, prepared, 1);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validación fallida", errors: result.errors },
      { status: 400 },
    );
  }

  if (mode === "append") {
    const { inserted, duplicates } = await insertValidatedRecords({
      themeId: theme.id,
      items: [result.data],
      source: "form",
      userId: authz.actor.userId,
    });
    if (!inserted.length) {
      return NextResponse.json(
        {
          error: "Registro duplicado (misma huella de negocio ya existe)",
          duplicates,
        },
        { status: 409 },
      );
    }
    const row = inserted[0];
    await writeAudit({
      userId: authz.actor.userId,
      action: "record.create",
      entity: "records",
      entityId: row?.id,
      after: row,
    });

    let maquetaSync: { ok: boolean; changedFields?: string[] } | undefined;
    let inventarioSync: { ok: boolean; changedFields?: string[] } | undefined;
    if (theme.id === "agua-y-saneamiento" && row) {
      const op = String(
        (row as Record<string, unknown>).orden_de_proveeduria ||
          (row as Record<string, unknown>).clave_seguimiento ||
          prepared.orden_de_proveeduria ||
          "",
      ).trim();
      const capa = String(
        (row as Record<string, unknown>).tipo_registro ||
          (row as Record<string, unknown>).capa ||
          prepared.capa ||
          "",
      );
      if (op && capa && capa !== "Alta / orden" && capa !== "Maqueta / orden") {
        maquetaSync = await syncAguaMaquetaFromLatest({
          op,
          userId: authz.actor.userId,
          sourceCapa: capa,
        });
      }
    }

    if (theme.id === "puentes" && row) {
      const idPuente = String(
        (row as Record<string, unknown>).id_puente ||
          (row as Record<string, unknown>).clave_seguimiento ||
          prepared.id_puente ||
          "",
      ).trim();
      const capa = String(
        (row as Record<string, unknown>).tipo_registro ||
          (row as Record<string, unknown>).capa ||
          prepared.capa ||
          "",
      );
      if (idPuente && capa === "Bitácora estado") {
        inventarioSync = await syncPuenteInventarioFromLatest({
          idPuente,
          userId: authz.actor.userId,
          sourceCapa: capa,
        });
      }
    }

    return NextResponse.json(
      { ok: true, record: row, mode: "append", maquetaSync, inventarioSync },
      { status: 201 },
    );
  }

  // upsert | create-once
  const classified = await classifyForUpsert(theme.id, [result.data], "upsert");
  const first = classified[0];

  if (mode === "create-once" && first?.action === "update") {
    return NextResponse.json(
      {
        error:
          "Ya existe un alta para esta orden de proveeduría. Use otro formulario para actualizar (T/U, líder, seguimiento, bitácora).",
        existingId: first.existingId,
      },
      { status: 409 },
    );
  }

  const { inserted, updated, duplicates } = await upsertValidatedRecords({
    themeId: theme.id,
    classified,
    source: "form",
    userId: authz.actor.userId,
  });

  if (!inserted.length && updated === 0) {
    return NextResponse.json(
      {
        error: "No se pudo guardar (duplicado u omitido)",
        duplicates,
      },
      { status: 409 },
    );
  }

  const row = inserted[0] || null;
  await writeAudit({
    userId: authz.actor.userId,
    action: updated > 0 ? "record.update" : "record.create",
    entity: "records",
    entityId: row?.id || first?.existingId,
    after: row || { id: first?.existingId, updated: true },
  });

  return NextResponse.json(
    {
      ok: true,
      record: row,
      updated,
      mode,
    },
    { status: updated > 0 ? 200 : 201 },
  );
}
