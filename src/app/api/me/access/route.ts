import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireSession } from "@/lib/auth/session";
import { countAclRows, listThemeAccess } from "@/lib/auth/acl";
import { canBypassThemeAcl, canWrite as roleCanWrite } from "@/lib/auth/roles";
import { THEMES } from "@/themes";
import type { AppRole } from "@/themes/shared/types";

function themesPayload(
  access: { themeId: string; canRead: boolean; canWrite: boolean }[],
) {
  const byId = new Map(access.map((a) => [a.themeId, a]));
  return THEMES.filter((t) => byId.has(t.id)).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    description: t.description,
    icon: t.icon,
    canRead: byId.get(t.id)!.canRead,
    canWrite: byId.get(t.id)!.canWrite,
  }));
}

export async function GET() {
  try {
    const authz = await requireSession();
    if (!authz.ok) return authz.response;

    const access = await listThemeAccess(authz.actor);
    const aclCount = await countAclRows(authz.actor.userId);

    return NextResponse.json({
      user: {
        id: authz.actor.userId,
        email: authz.actor.email,
        name: authz.actor.name,
        role: authz.actor.role,
      },
      aclAssigned: aclCount > 0,
      aclStrict: process.env.ACL_STRICT === "true",
      dbDegraded: false,
      themes: themesPayload(access),
    });
  } catch (err) {
    // DB caída: igual listar temas para admin/subdirector (bypass ACL)
    // para no dejar TEMAS (0) mientras se corrige DATABASE_URL.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const role = (session.user.role || "operativo") as AppRole;
    if (!canBypassThemeAcl(role) && process.env.ACL_STRICT === "true") {
      return NextResponse.json(
        {
          error: "Base de datos no disponible",
          detail: err instanceof Error ? err.message : "db error",
          themes: [],
          dbDegraded: true,
        },
        { status: 503 },
      );
    }
    const write = roleCanWrite(role);
    const access = THEMES.map((t) => ({
      themeId: t.id,
      canRead: true,
      canWrite: write,
    }));
    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name || "",
        role,
      },
      aclAssigned: false,
      aclStrict: process.env.ACL_STRICT === "true",
      dbDegraded: true,
      warning:
        "Base de datos no disponible. Listado de temas desde código; datos operativos fallarán hasta corregir DATABASE_URL en Vercel.",
      themes: themesPayload(access),
    });
  }
}
