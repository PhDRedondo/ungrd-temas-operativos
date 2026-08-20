import { NextResponse } from "next/server";
import type { AccountRecord } from "@/lib/accounts";
import { toPublicAccounts } from "@/lib/accountsPublic";
import {
  actorCanCreateAccounts,
  readAccountsFile,
  writeAccountsFile,
} from "@/lib/accountsServer";
import { requireAdmin, requireSession } from "@/lib/auth/session";

/**
 * Sync directorio demo cliente → servidor.
 * GET: solo admin, sin contraseñas.
 * POST: sesión + permiso de gestión de cuentas (no anónimo).
 */
export async function POST(req: Request) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  if (
    !actorCanCreateAccounts(authz.actor.email, authz.actor.role) &&
    authz.actor.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Sin permiso para sincronizar cuentas" },
      { status: 403 },
    );
  }

  try {
    const body = (await req.json()) as { accounts?: AccountRecord[] };
    if (!Array.isArray(body.accounts) || body.accounts.length === 0) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    // writeAccountsFile hashea contraseñas en texto plano automáticamente
    writeAccountsFile(body.accounts);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo sincronizar" }, { status: 500 });
  }
}

export async function GET() {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;
  return NextResponse.json({ accounts: toPublicAccounts(readAccountsFile()) });
}
