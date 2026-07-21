import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { countAclRows, listThemeAccess } from "@/lib/auth/acl";
import { THEMES } from "@/themes";

export async function GET() {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const access = await listThemeAccess(authz.actor);
  const aclCount = await countAclRows(authz.actor.userId);
  const byId = new Map(access.map((a) => [a.themeId, a]));

  const themes = THEMES.filter((t) => byId.has(t.id)).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    description: t.description,
    icon: t.icon,
    canRead: byId.get(t.id)!.canRead,
    canWrite: byId.get(t.id)!.canWrite,
  }));

  return NextResponse.json({
    user: {
      id: authz.actor.userId,
      email: authz.actor.email,
      name: authz.actor.name,
      role: authz.actor.role,
    },
    aclAssigned: aclCount > 0,
    aclStrict: process.env.ACL_STRICT === "true",
    themes,
  });
}
