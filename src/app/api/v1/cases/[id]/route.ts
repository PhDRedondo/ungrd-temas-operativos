import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import {
  getCaseById,
  getCaseVersions,
  listFindings,
} from "@/lib/workflow/repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;
  const c = await getCaseById(id);
  if (!c) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }

  const versions = await getCaseVersions(id);
  const findings = await listFindings(id);

  return NextResponse.json({ case: c, versions, findings });
}
