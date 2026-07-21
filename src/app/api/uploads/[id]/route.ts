import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { canAdmin } from "@/lib/auth/roles";
import { assertThemeRead } from "@/lib/auth/acl";
import { errorsToCsv, getUploadById } from "@/lib/uploads/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;
  const upload = await getUploadById(id);
  if (!upload) {
    return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 });
  }

  const isOwner = upload.createdBy === authz.actor.userId;
  const isPriv =
    canAdmin(authz.actor.role) || authz.actor.role === "auditor";
  if (!isOwner && !isPriv) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const themeOk = await assertThemeRead(authz.actor, upload.themeId);
  if (!themeOk.ok && !isPriv) {
    return NextResponse.json({ error: themeOk.error }, { status: 403 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    const csv = errorsToCsv(
      Array.isArray(upload.errors) ? upload.errors : [],
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="errores_${upload.id}.csv"`,
      },
    });
  }

  return NextResponse.json({
    upload: {
      id: upload.id,
      themeId: upload.themeId,
      fileName: upload.fileName,
      status: upload.status,
      accepted: upload.accepted,
      rejected: upload.rejected,
      schemaVersion: upload.schemaVersion,
      errors: upload.errors,
      createdAt: upload.createdAt.toISOString(),
      finishedAt: upload.finishedAt?.toISOString() ?? null,
      createdByEmail: upload.createdByEmail,
      createdByName: upload.createdByName,
    },
  });
}
