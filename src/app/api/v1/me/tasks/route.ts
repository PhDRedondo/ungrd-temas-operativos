import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listTasksForUser } from "@/lib/workflow/repository";

export async function GET() {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const tasks = await listTasksForUser({
    userId: authz.actor.userId,
    role: authz.actor.role,
  });

  return NextResponse.json({ tasks, count: tasks.length });
}
