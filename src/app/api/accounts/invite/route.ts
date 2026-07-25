import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  actorCanCreateAccounts,
  createInviteAccountOnServer,
} from "@/lib/accountsServer";
import { isEmailConfigured } from "@/lib/email/resend";
import { sendAccountInviteEmail } from "@/lib/email/sendInviteEmail";

const bodySchema = z.object({
  username: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  role: z.enum(["subdirector", "coordinador", "operativo"]),
  canCreateAccounts: z.boolean().optional(),
});

function appBaseUrl(req: Request): string {
  const fromEnv =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const actorEmail = session.user.email;
  if (!actorCanCreateAccounts(actorEmail, session.user.role)) {
    return NextResponse.json(
      { error: "No tiene permiso para crear cuentas." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = createInviteAccountOnServer({
    username: parsed.data.username,
    name: parsed.data.name,
    role: parsed.data.role,
    canCreateAccounts: parsed.data.canCreateAccounts,
    createdByEmail: actorEmail,
    createdByRole: session.user.role,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  const inviteUrl = `${appBaseUrl(req)}${created.invitePath}`;
  const mail = await sendAccountInviteEmail({
    to: created.account.email,
    name: created.account.name,
    role: created.account.role,
    inviteUrl,
    invitedBy: session.user.name || actorEmail,
  });

  return NextResponse.json({
    ok: true,
    account: created.account,
    inviteUrl,
    emailConfigured: isEmailConfigured(),
    emailSent: mail.ok,
    emailId: mail.ok ? mail.id : undefined,
    emailError: mail.ok ? undefined : mail.error,
  });
}
