import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

type ServiceHealth = {
  configured: boolean;
  connected: boolean;
  label: string;
};

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const [soniox, openrouter, supabaseStatus, moyasar, resend] =
    await Promise.all([
      checkSoniox(),
      checkOpenRouter(),
      checkSupabase(),
      checkMoyasar(),
      checkResend(),
    ]);

  const coreConnected =
    soniox.connected && openrouter.connected && supabaseStatus.connected;

  return NextResponse.json({
    ok: coreConnected,
    services: {
      supabase: supabaseStatus,
      soniox,
      openrouter,
      moyasar,
      resend,
    },
  });
}

async function checkSoniox(): Promise<ServiceHealth> {
  const key = process.env.SONIOX_API_KEY;
  if (!key) {
    return { configured: false, connected: false, label: "Missing API key" };
  }
  try {
    const res = await fetch(
      "https://api.soniox.com/v1/auth/temporary-api-key",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usage_type: "transcribe_websocket",
          expires_in_seconds: 60,
        }),
      }
    );
    return {
      configured: true,
      connected: res.ok,
      label: res.ok ? "Connected" : `Request failed (${res.status})`,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      label: "Network request failed",
    };
  }
}

async function checkOpenRouter(): Promise<ServiceHealth> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { configured: false, connected: false, label: "Missing API key" };
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return {
      configured: true,
      connected: res.ok,
      label: res.ok ? "Connected" : `Request failed (${res.status})`,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      label: "Network request failed",
    };
  }
}

async function checkSupabase(): Promise<ServiceHealth> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase
      .from("settings")
      .select("user_id")
      .limit(1);
    return {
      configured: true,
      connected: !error,
      label: error ? error.message : "Connected",
    };
  } catch {
    return {
      configured: false,
      connected: false,
      label: "Supabase client failed",
    };
  }
}

async function checkMoyasar(): Promise<ServiceHealth> {
  const secret = process.env.MOYASAR_SECRET_KEY;
  const publishable = process.env.MOYASAR_PUBLISHABLE_KEY;
  if (!secret || !publishable) {
    return {
      configured: false,
      connected: false,
      label: "Missing API key(s)",
    };
  }
  try {
    const res = await fetch("https://api.moyasar.com/v1/payments?page=1", {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      },
    });
    return {
      configured: true,
      connected: res.ok || res.status === 401,
      label: res.ok ? "Connected" : `Status ${res.status}`,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      label: "Network request failed",
    };
  }
}

async function checkResend(): Promise<ServiceHealth> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { configured: false, connected: false, label: "Missing API key" };
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return {
      configured: true,
      connected: res.ok,
      label: res.ok ? "Connected" : `Status ${res.status}`,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      label: "Network request failed",
    };
  }
}
