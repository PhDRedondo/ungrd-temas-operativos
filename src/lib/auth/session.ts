import { auth } from "@/auth";
import { canAdmin, canRead, canWrite } from "@/lib/auth/roles";
import { assertThemeRead, assertThemeWrite } from "@/lib/auth/acl";
import { ensureUser } from "@/lib/records/repository";
import type { AppRole } from "@/themes/shared/types";
import { NextResponse } from "next/server";

export type SessionActor = {
  keycloakSub: string;
  email: string;
  name: string;
  role: AppRole;
  userId: string;
};

export async function requireSession(): Promise<
  { ok: true; actor: SessionActor } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const role = (session.user.role || "analista") as AppRole;
  if (!canRead(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sin permiso" }, { status: 403 }),
    };
  }

  const userId = await ensureUser({
    keycloakSub: session.user.id,
    email: session.user.email || `${session.user.id}@local`,
    name: session.user.name || "Usuario UNGRD",
    role,
  });

  return {
    ok: true,
    actor: {
      keycloakSub: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      role,
      userId,
    },
  };
}

export async function requireWrite() {
  const result = await requireSession();
  if (!result.ok) return result;
  if (!canWrite(result.actor.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Rol sin permiso de escritura (requiere captura o admin)" },
        { status: 403 },
      ),
    };
  }
  return result;
}

export async function requireAdmin() {
  const result = await requireSession();
  if (!result.ok) return result;
  if (!canAdmin(result.actor.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Se requiere rol admin" },
        { status: 403 },
      ),
    };
  }
  return result;
}

export async function requireThemeRead(themeId: string) {
  const result = await requireSession();
  if (!result.ok) return result;
  const access = await assertThemeRead(result.actor, themeId);
  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: access.error }, { status: 403 }),
    };
  }
  return { ok: true as const, actor: result.actor, access: access.access };
}

export async function requireThemeWrite(themeId: string) {
  const result = await requireSession();
  if (!result.ok) return result;
  const access = await assertThemeWrite(result.actor, themeId);
  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: access.error }, { status: 403 }),
    };
  }
  return { ok: true as const, actor: result.actor, access: access.access };
}
