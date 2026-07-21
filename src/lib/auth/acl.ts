import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userThemeAccess } from "@/db/schema";
import { THEMES } from "@/themes";
import { canAdmin, canWrite as roleCanWrite } from "@/lib/auth/roles";
import type { AppRole } from "@/themes/shared/types";
import type { SessionActor } from "@/lib/auth/session";

export type ThemeAccess = {
  themeId: string;
  canRead: boolean;
  canWrite: boolean;
};

function strictAcl(): boolean {
  return process.env.ACL_STRICT === "true";
}

/** Lista de acceso efectivo del actor. */
export async function listThemeAccess(
  actor: SessionActor,
): Promise<ThemeAccess[]> {
  if (canAdmin(actor.role) || actor.role === "auditor") {
    return THEMES.map((t) => ({
      themeId: t.id,
      canRead: true,
      canWrite: canAdmin(actor.role),
    }));
  }

  const rows = await db
    .select()
    .from(userThemeAccess)
    .where(eq(userThemeAccess.userId, actor.userId));

  if (!rows.length) {
    if (strictAcl()) return [];
    // Local-friendly: sin ACL asignada → acceso según rol global
    const write = roleCanWrite(actor.role);
    return THEMES.map((t) => ({
      themeId: t.id,
      canRead: true,
      canWrite: write,
    }));
  }

  const byId = new Map(
    rows.map((r) => [
      r.themeId,
      {
        themeId: r.themeId,
        canRead: r.canRead === 1,
        canWrite: r.canWrite === 1 && roleCanWrite(actor.role),
      },
    ]),
  );

  return THEMES.filter((t) => byId.has(t.id)).map((t) => byId.get(t.id)!);
}

export async function getThemeAccess(
  actor: SessionActor,
  themeId: string,
): Promise<ThemeAccess | null> {
  const all = await listThemeAccess(actor);
  return all.find((a) => a.themeId === themeId) ?? null;
}

export async function assertThemeRead(actor: SessionActor, themeId: string) {
  const access = await getThemeAccess(actor, themeId);
  if (!access?.canRead) {
    return {
      ok: false as const,
      error: "Sin permiso de lectura sobre este tema",
    };
  }
  return { ok: true as const, access };
}

export async function assertThemeWrite(actor: SessionActor, themeId: string) {
  if (!roleCanWrite(actor.role)) {
    return {
      ok: false as const,
      error: "Rol sin permiso de escritura (requiere captura o admin)",
    };
  }
  const access = await getThemeAccess(actor, themeId);
  if (!access?.canWrite) {
    return {
      ok: false as const,
      error: "Sin permiso de escritura sobre este tema",
    };
  }
  return { ok: true as const, access };
}

export async function replaceUserThemeAccess(params: {
  userId: string;
  entries: { themeId: string; canRead: boolean; canWrite: boolean }[];
}) {
  await db
    .delete(userThemeAccess)
    .where(eq(userThemeAccess.userId, params.userId));

  if (!params.entries.length) return;

  await db.insert(userThemeAccess).values(
    params.entries.map((e) => ({
      userId: params.userId,
      themeId: e.themeId,
      canRead: e.canRead ? 1 : 0,
      canWrite: e.canWrite ? 1 : 0,
    })),
  );
}

export async function listAclForUser(userId: string) {
  return db
    .select()
    .from(userThemeAccess)
    .where(eq(userThemeAccess.userId, userId));
}

export async function countAclRows(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userThemeAccess)
    .where(eq(userThemeAccess.userId, userId));
  return row?.n ?? 0;
}

export function roleDefaultWrite(role: AppRole) {
  return roleCanWrite(role);
}

export async function findAccessRow(userId: string, themeId: string) {
  const [row] = await db
    .select()
    .from(userThemeAccess)
    .where(
      and(
        eq(userThemeAccess.userId, userId),
        eq(userThemeAccess.themeId, themeId),
      ),
    )
    .limit(1);
  return row ?? null;
}
