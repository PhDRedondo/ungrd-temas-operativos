import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAdmin } from "@/lib/auth/roles";
import type { AccountRecord } from "@/lib/accounts";
import { toPublicAccounts } from "@/lib/accountsPublic";
import { readAccountsFile, writeAccountsFile } from "@/lib/accountsServer";

export async function GET() {
  const session = await auth();
  if (!session?.user || !canAdmin(session.user.role)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  return NextResponse.json({ accounts: toPublicAccounts(readAccountsFile()) });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || !canAdmin(session.user.role)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  const body = (await req.json()) as { accounts?: AccountRecord[] };
  if (!Array.isArray(body.accounts)) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  writeAccountsFile(body.accounts);
  return NextResponse.json({ ok: true });
}
