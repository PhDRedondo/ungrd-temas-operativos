import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  listAclForUser,
  replaceUserThemeAccess,
} from "@/lib/auth/acl";
import { THEMES } from "@/themes";
import { writeAudit } from "@/lib/records/repository";
import { z } from "zod";

export async function GET(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .orderBy(users.email);

  if (!userId) {
    return NextResponse.json({
      users: allUsers,
      themes: THEMES.map((t) => ({ id: t.id, name: t.name })),
    });
  }

  const [user] = allUsers.filter((u) => u.id === userId);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const acl = await listAclForUser(userId);
  return NextResponse.json({
    user,
    themes: THEMES.map((t) => ({ id: t.id, name: t.name })),
    access: acl.map((a) => ({
      themeId: a.themeId,
      canRead: a.canRead === 1,
      canWrite: a.canWrite === 1,
    })),
  });
}

const putSchema = z.object({
  userId: z.string().uuid(),
  entries: z.array(
    z.object({
      themeId: z.string().min(1),
      canRead: z.boolean(),
      canWrite: z.boolean(),
    }),
  ),
});

export async function PUT(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const body = putSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: body.error.issues },
      { status: 400 },
    );
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, body.data.userId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const validIds = new Set(THEMES.map((t) => t.id));
  const entries = body.data.entries.filter((e) => validIds.has(e.themeId));

  await replaceUserThemeAccess({
    userId: body.data.userId,
    entries,
  });

  await writeAudit({
    userId: authz.actor.userId,
    action: "acl.replace",
    entity: "user_theme_access",
    entityId: body.data.userId,
    after: entries,
  });

  return NextResponse.json({ ok: true, count: entries.length });
}
