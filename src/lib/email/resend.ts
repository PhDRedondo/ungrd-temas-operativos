/**
 * Envío genérico por Resend HTTP API.
 */

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; skipped?: boolean };

export function getEmailFromAddress(): string | null {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.REPORT_EMAIL_FROM?.trim() ||
    null
  );
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && getEmailFromAddress());
}

export async function sendResendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getEmailFromAddress();

  if (!apiKey || !from) {
    return {
      ok: false,
      skipped: true,
      error:
        "Faltan RESEND_API_KEY o EMAIL_FROM (o REPORT_EMAIL_FROM) en el entorno",
    };
  }

  const to = (Array.isArray(opts.to) ? opts.to : [opts.to])
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    return { ok: false, error: "Destinatario vacío" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error de envío",
    };
  }
}
