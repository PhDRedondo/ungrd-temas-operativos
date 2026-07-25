import { ROLE_LABELS, type AccountRole } from "@/lib/accounts";
import { sendResendEmail, type SendEmailResult } from "@/lib/email/resend";

export async function sendAccountInviteEmail(opts: {
  to: string;
  name: string;
  role: AccountRole;
  inviteUrl: string;
  invitedBy?: string;
}): Promise<SendEmailResult> {
  const roleLabel = ROLE_LABELS[opts.role] || opts.role;
  const subject = "Invitación — Plataforma de Temas Operativos UNGRD";
  const greeting = opts.name?.trim() || opts.to;
  const byline = opts.invitedBy
    ? `<p style="margin:0 0 16px;color:#5a6b7d;font-size:14px;">Invitado por: ${escapeHtml(opts.invitedBy)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f3f6f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8e0e8;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#001a36;padding:20px 24px;">
              <p style="margin:0;color:#ffd100;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">UNGRD</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:800;">Temas Operativos</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px;color:#0f1c2e;font-size:16px;">Hola, <strong>${escapeHtml(greeting)}</strong>.</p>
              <p style="margin:0 0 16px;color:#5a6b7d;font-size:14px;line-height:1.5;">
                Se creó su cuenta institucional (<strong style="color:#002d5a;">${escapeHtml(opts.to)}</strong>)
                con rol <strong style="color:#002d5a;">${escapeHtml(roleLabel)}</strong>.
                Para activarla, defina su contraseña con el siguiente enlace:
              </p>
              ${byline}
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(opts.inviteUrl)}"
                   style="display:inline-block;background:#002d5a;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 18px;border-radius:8px;">
                  Definir contraseña
                </a>
              </p>
              <p style="margin:0 0 8px;color:#5a6b7d;font-size:12px;line-height:1.4;word-break:break-all;">
                Si el botón no funciona, copie este enlace:<br/>
                <a href="${escapeHtml(opts.inviteUrl)}" style="color:#002d5a;">${escapeHtml(opts.inviteUrl)}</a>
              </p>
              <p style="margin:16px 0 0;color:#5a6b7d;font-size:12px;">
                Si usted no esperaba esta invitación, ignore este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola, ${greeting}.`,
    ``,
    `Se creó su cuenta ${opts.to} (rol: ${roleLabel}).`,
    `Defina su contraseña aquí:`,
    opts.inviteUrl,
    ``,
    `Si no esperaba esta invitación, ignore este mensaje.`,
  ].join("\n");

  return sendResendEmail({
    to: opts.to,
    subject,
    html,
    text,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
