import { NextResponse } from "next/server";
import type { AccountRecord } from "@/lib/accounts";
import { readAccountsFile, writeAccountsFile } from "@/lib/accountsServer";

/** Sync client directory → server file (demo). Used after create/invite password. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { accounts?: AccountRecord[] };
    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    writeAccountsFile(body.accounts);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo sincronizar" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ accounts: readAccountsFile() });
}
