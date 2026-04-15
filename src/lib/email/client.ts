type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send email via Resend. No-op (with warning) if RESEND_API_KEY is missing,
 * so dev environments don't break when email isn't configured.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id?: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL missing; skipping send", { subject: input.subject });
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }

  return res.json();
}
