import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeWrite, requireThemeRead } from "@/lib/auth/session";
import {
  getRecordById,
  listRecordVersions,
  patchRecordWithVersion,
  restoreRecordVersion,
} from "@/lib/records/versions";
import { sanitizePuentePatch } from "@/themes/puentes/proceso-chain";
import { sanitizeCarroMaquetaCategoriasPatch } from "@/themes/carrotanques/maqueta-mutable";
import {
  BMAQ_CONVENIO_MUTABLE_FIELDS,
  BMAQ_MAQUETA_MUTABLE_FIELDS,
  sanitizeBmaqConvenioAvancePatch,
  sanitizeBmaqMaquetaOperativoPatch,
} from "@/themes/banco-de-maquinaria/maqueta-mutable";
import { normalizeCarroCapa } from "@/themes/carrotanques/capture-forms";
import { normalizeBmaqCapa } from "@/themes/banco-de-maquinaria/capture-forms";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const row = await getRecordById(id);
  if (!row || row.themeId !== theme.id) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  const versions = await listRecordVersions(id);
  return NextResponse.json({
    recordId: id,
    currentVersion: versions[0]?.version || 0,
    versions,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const body = (await req.json()) as {
    values?: Record<string, unknown>;
    reason?: string;
  };

  try {
    let patch = body.values || {};
    // Puentes: el contrato solo se edita en la capa que lo origina.
    if (theme.id === "puentes") {
      patch = await sanitizePuentePatch(id, patch);
    }
    // Carrotanques: si el PATCH solo trae K–L (o mezcla), no permitir pisar B–J.
    if (theme.id === "carrotanques") {
      const current = await getRecordById(id);
      const capa = normalizeCarroCapa(
        String(
          (current?.payload as Record<string, unknown> | undefined)
            ?.tipo_registro ||
            (current?.payload as Record<string, unknown> | undefined)?.capa ||
            "",
        ),
      );
      const keys = Object.keys(patch);
      const touchesCategorias = keys.some(
        (k) =>
          k === "otras_categorizaciones" || k === "clasificacion_propiedad",
      );
      const onlyMutableOrMeta = keys.every((k) =>
        [
          "otras_categorizaciones",
          "clasificacion_propiedad",
          "placa",
          "clave_seguimiento",
          "tipo_registro",
          "capa",
        ].includes(k),
      );
      if (capa === "Maqueta / inventario" && touchesCategorias && onlyMutableOrMeta) {
        patch = sanitizeCarroMaquetaCategoriasPatch(patch);
      }
    }
    if (theme.id === "banco-de-maquinaria") {
      const current = await getRecordById(id);
      const capa = normalizeBmaqCapa(
        String(
          (current?.payload as Record<string, unknown> | undefined)
            ?.tipo_registro ||
            (current?.payload as Record<string, unknown> | undefined)?.capa ||
            "",
        ),
      );
      const keys = Object.keys(patch);
      if (capa === "Maqueta / inventario") {
        const mutableSet = new Set<string>([
          ...BMAQ_MAQUETA_MUTABLE_FIELDS,
          "serial",
          "clave_seguimiento",
          "tipo_registro",
          "capa",
        ]);
        const touchesOperativo = keys.some((k) =>
          (BMAQ_MAQUETA_MUTABLE_FIELDS as readonly string[]).includes(k),
        );
        const onlyMutableOrMeta = keys.every((k) => mutableSet.has(k));
        if (touchesOperativo && onlyMutableOrMeta) {
          patch = sanitizeBmaqMaquetaOperativoPatch(patch);
        }
      }
      if (capa === "Convenio o proceso") {
        const mutableSet = new Set<string>([
          ...BMAQ_CONVENIO_MUTABLE_FIELDS,
          "no_convenio",
          "clave_seguimiento",
          "tipo_registro",
          "capa",
        ]);
        const touchesAvance = keys.some((k) =>
          (BMAQ_CONVENIO_MUTABLE_FIELDS as readonly string[]).includes(k),
        );
        const onlyMutableOrMeta = keys.every((k) => mutableSet.has(k));
        if (touchesAvance && onlyMutableOrMeta) {
          patch = sanitizeBmaqConvenioAvancePatch(patch);
        }
      }
    }
    const result = await patchRecordWithVersion({
      theme,
      recordId: id,
      patch,
      userId: authz.actor.userId,
      reason: body.reason,
    });
    return NextResponse.json({
      ok: true,
      record: result.record,
      version: result.version,
      changedFields: result.changedFields,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al actualizar";
    const status = msg.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
