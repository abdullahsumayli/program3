const MOYASAR_BASE = "https://api.moyasar.com/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getPublishableKey(): string {
  return requireEnv("MOYASAR_PUBLISHABLE_KEY");
}

type CreatePaymentInput = {
  amountSAR: number;
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
};

export async function createPayment(input: CreatePaymentInput) {
  const secret = requireEnv("MOYASAR_SECRET_KEY");

  const res = await fetch(`${MOYASAR_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(input.amountSAR * 100),
      currency: "SAR",
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  if (!res.ok) {
    throw new Error(`Moyasar error: ${await res.text()}`);
  }

  return res.json() as Promise<{ id: string; status: string; source: { transaction_url?: string } | null }>;
}

export async function getPayment(paymentId: string) {
  const secret = requireEnv("MOYASAR_SECRET_KEY");

  const res = await fetch(`${MOYASAR_BASE}/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Moyasar error: ${await res.text()}`);
  }

  return res.json();
}

/**
 * Verify a Moyasar webhook signature. Moyasar signs webhook payloads using an
 * HMAC shared secret configured in their dashboard.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string | null
): Promise<boolean> {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret || !receivedSignature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, receivedSignature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
