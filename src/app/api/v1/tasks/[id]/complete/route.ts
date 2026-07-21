import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { completeTask } from "@/lib/workflow/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    action?: "approve" | "return" | "reject";
    comment?: string;
    findings?: Array<{
      fieldCode?: string;
      sectionCode?: string;
      severity: string;
      observation: string;
    }>;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action requerida" }, { status: 400 });
  }

  try {
    const result = await completeTask({
      taskId: id,
      action: body.action,
      userId: authz.actor.userId,
      role: authz.actor.role,
      comment: body.comment,
      findings: body.findings,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 400 },
    );
  }
}
