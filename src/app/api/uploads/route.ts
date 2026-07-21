import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { canAdmin } from "@/lib/auth/roles";
import { listThemeAccess } from "@/lib/auth/acl";
import { listUploads } from "@/lib/uploads/repository";

export async function GET(req: Request) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const themeId = url.searchParams.get("themeId") || undefined;
  const mine = url.searchParams.get("mine") === "1";

  if (themeId) {
    const access = await listThemeAccess(authz.actor);
    const ok = access.some((a) => a.themeId === themeId && a.canRead);
    if (!ok) {
      return NextResponse.json(
        { error: "Sin permiso sobre este tema" },
        { status: 403 },
      );
    }
  }

  const uploads = await listUploads({
    themeId,
    userId: mine || !canAdmin(authz.actor.role) ? authz.actor.userId : undefined,
    limit: 100,
  });

  // Filtrar uploads a temas legibles si no es admin/auditor
  if (!canAdmin(authz.actor.role) && authz.actor.role !== "auditor") {
    const allowed = new Set(
      (await listThemeAccess(authz.actor)).map((a) => a.themeId),
    );
    return NextResponse.json({
      uploads: uploads.filter((u) => allowed.has(u.themeId)),
    });
  }

  return NextResponse.json({ uploads });
}
