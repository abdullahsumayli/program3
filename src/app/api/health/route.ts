import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getAppSecrets } from "@/lib/app-secrets";
import { requireUser } from "@/lib/supabase/auth";

type ServiceHealth = {
  configured: boolean;
  connected: boolean;
  label: string;
};

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const includeAdminServices = url.searchParams.get("scope") === "admin";

  if (includeAdminServices && !isAdminEmail(auth.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const secrets = await getAppSecrets();

  const [soniox, openrouter, supabaseStatus] = await Promise.all([
    checkSoniox(secrets.SONIOX_API_KEY),
    checkOpenRouter(secrets.OPENROUTER_API_KEY),
    checkSupabase(),
  ]);

  const coreConnected =
    soniox.connected && openrouter.connected && supabaseStatus.connected;

  const adminServices = includeAdminServices
    ? await Promise.all([
        checkMoyasar(secrets.MOYASAR_SECRET_KEY, secrets.MOYASAR_PUBLISHABLE_KEY),
        checkResend(secrets.RESEND_API_KEY),
      ]).then(
        ([moyasar, resend]) => ({ moyasar, resend })
      )
    : {};

  return NextResponse.json({
    ok: coreConnected,
    services: {
      supabase: supabaseStatus,
      soniox,
      openrouter,
      ...adminServices,
    },
  });
}

async function checkSoniox(key: string | null | undefined): Promise<ServiceHealth> {
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

async function checkOpenRouter(key: string | null | undefined): Promise<ServiceHealth> {
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

async function checkMoyasar(
  secret: string | null | undefined,
  publishable: string | null | undefined
): Promise<ServiceHealth> {
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

async function checkResend(key: string | null | undefined): Promise<ServiceHealth> {
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
