import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  createCase,
  listCasesForUser,
  getUserPrimaryDependency,
} from "@/lib/workflow/repository";

export async function GET() {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const rows = await listCasesForUser(
    authz.actor.userId,
    authz.actor.role,
  );
  return NextResponse.json({ cases: rows, count: rows.length });
}

export async function POST(req: Request) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => null)) as {
    caseType?: string;
    moduleId?: string;
    title?: string;
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.title || !body?.caseType) {
    return NextResponse.json(
      { error: "caseType y title son obligatorios" },
      { status: 400 },
    );
  }

  const depId =
    (await getUserPrimaryDependency(authz.actor.userId)) ?? undefined;

  const created = await createCase({
    caseType: body.caseType,
    moduleId: body.moduleId,
    title: body.title,
    payload: body.payload ?? {},
    userId: authz.actor.userId,
    dependencyId: depId,
    role: authz.actor.role,
  });

  return NextResponse.json({ case: created }, { status: 201 });
}
