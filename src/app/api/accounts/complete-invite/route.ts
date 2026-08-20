import { NextResponse } from "next/server";
import { z } from "zod";
import { completeInvitePasswordOnServer } from "@/lib/accountsServer";

const bodySchema = z.object({
  token: z.string().min(8).max(200),
  password: z.string().min(8).max(200),
});

/** Completa invitación sin sesión (token de un solo uso). */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = completeInvitePasswordOnServer(
    parsed.data.token,
    parsed.data.password,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: result.email });
}
