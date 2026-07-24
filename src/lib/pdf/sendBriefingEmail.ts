/**
 * Envío de briefing PDF por correo (Resend HTTP API).
 * Si faltan env vars, no lanza: el caller puede solo loguear.
 */
export type SendBriefingResult =
  | { ok: true; skipped?: false; id?: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export async function sendBriefingPdfEmail(opts: {
  pdf: ArrayBuffer;
  filename: string;
  subject: string;
  htmlBody: string;
}): Promise<SendBriefingResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REPORT_EMAIL_FROM?.trim();
  const toRaw = process.env.REPORT_EMAIL_TO?.trim();

  if (!apiKey || !from || !toRaw) {
    return {
      ok: true,
      skipped: true,
      reason:
        "Faltan RESEND_API_KEY, REPORT_EMAIL_FROM o REPORT_EMAIL_TO — PDF generado sin envío",
    };
  }

  const to = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "REPORT_EMAIL_TO vacío",
    };
  }

  const attachment = Buffer.from(opts.pdf).toString("base64");

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
        html: opts.htmlBody,
        attachments: [
          {
            filename: opts.filename,
            content: attachment,
          },
        ],
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
