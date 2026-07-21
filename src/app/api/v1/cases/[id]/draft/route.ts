import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth/session";
import {
  updateCaseDraft,
  getUserPrimaryDependency,
} from "@/lib/workflow/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const authz = await requireWrite();
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.payload) {
    return NextResponse.json({ error: "payload requerido" }, { status: 400 });
  }

  try {
    const depId =
      (await getUserPrimaryDependency(authz.actor.userId)) ?? undefined;
    const updated = await updateCaseDraft({
      caseId: id,
      payload: body.payload,
      userId: authz.actor.userId,
      role: authz.actor.role,
      dependencyId: depId,
    });
    return NextResponse.json({ case: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 400 },
    );
  }
}
