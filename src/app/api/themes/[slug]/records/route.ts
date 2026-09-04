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
import { syncCarrotanqueMaquetaFromLatest } from "@/themes/carrotanques/maqueta-sync";
import {
  syncBmaqConvenioFromBitacora,
  syncBmaqDetalleFromEntrega,
} from "@/themes/banco-de-maquinaria/maqueta-sync";
import { normalizeCarroCapa } from "@/themes/carrotanques/capture-forms";
import { normalizeBmaqCapa } from "@/themes/banco-de-maquinaria/capture-forms";
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

    let carroSync: { ok: boolean; changedFields?: string[] } | undefined;
    if (theme.id === "carrotanques" && row) {
      const placa = String(
        (row as Record<string, unknown>).placa ||
          (row as Record<string, unknown>).clave_seguimiento ||
          prepared.placa ||
          "",
      ).trim();
      const capa = normalizeCarroCapa(
        String(
          (row as Record<string, unknown>).tipo_registro ||
            (row as Record<string, unknown>).capa ||
            prepared.capa ||
            "",
        ),
      );
      if (
        placa &&
        (capa === "Bitácora estado" || capa === "Suministro / viajes")
      ) {
        carroSync = await syncCarrotanqueMaquetaFromLatest({
          placa,
          userId: authz.actor.userId,
          sourceCapa: capa,
        });
      }
    }

    let bmaqSync: { ok: boolean; changedFields?: string[] } | undefined;
    if (theme.id === "banco-de-maquinaria" && row) {
      const capa = normalizeBmaqCapa(
        String(
          (row as Record<string, unknown>).tipo_registro ||
            (row as Record<string, unknown>).capa ||
            prepared.capa ||
            "",
        ),
      );
      if (capa === "Bitácora convenio") {
        const noConvenio = String(
          (row as Record<string, unknown>).no_convenio ||
            (row as Record<string, unknown>).clave_seguimiento ||
            prepared.no_convenio ||
            "",
        ).trim();
        if (noConvenio) {
          bmaqSync = await syncBmaqConvenioFromBitacora({
            noConvenio,
            userId: authz.actor.userId,
            sourceCapa: capa,
          });
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        record: row,
        mode: "append",
        maquetaSync,
        inventarioSync,
        carroSync,
        bmaqSync,
      },
      { status: 201 },
    );
  }

  // upsert | create-once
  const classified = await classifyForUpsert(theme.id, [result.data], "upsert");
  const first = classified[0];

  if (mode === "create-once" && first?.action === "update") {
    const dupMsg =
      theme.id === "carrotanques"
        ? "Ya existe un alta de maqueta para esta placa. Use el formulario de categorías u otra capa."
        : theme.id === "banco-de-maquinaria"
          ? "Ya existe un registro con esta clave (convenio o serial). Use avance F–I, operativo, bitácora o entrega según corresponda."
          : theme.id === "fic"
            ? "Ya existe un alta para este FIC. Use Seguimiento legalización o Modificación / prórroga."
            : "Ya existe un alta para esta orden de proveeduría. Use otro formulario para actualizar (T/U, líder, seguimiento, bitácora).";
    return NextResponse.json(
      {
        error: dupMsg,
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

  let bmaqSync: { ok: boolean; changedFields?: string[] } | undefined;
  if (theme.id === "banco-de-maquinaria") {
    const capa = normalizeBmaqCapa(
      String(
        prepared.tipo_registro ||
          prepared.capa ||
          (row as Record<string, unknown> | null)?.tipo_registro ||
          (row as Record<string, unknown> | null)?.capa ||
          "",
      ),
    );
    if (capa === "Entrega a beneficiario") {
      const serial = String(
        prepared.serial ||
          prepared.clave_seguimiento ||
          (row as Record<string, unknown> | null)?.serial ||
          "",
      ).trim();
      if (serial) {
        bmaqSync = await syncBmaqDetalleFromEntrega({
          serial,
          userId: authz.actor.userId,
          sourceCapa: capa,
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      record: row,
      updated,
      mode,
      bmaqSync,
    },
    { status: updated > 0 ? 200 : 201 },
  );
}
