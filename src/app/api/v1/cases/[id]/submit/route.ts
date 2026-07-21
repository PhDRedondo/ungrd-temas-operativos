import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth/session";
import { submitCase } from "@/lib/workflow/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const authz = await requireWrite();
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;

  try {
    const updated = await submitCase({
      caseId: id,
      userId: authz.actor.userId,
      role: authz.actor.role,
    });
    return NextResponse.json({ case: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 400 },
    );
  }
}
