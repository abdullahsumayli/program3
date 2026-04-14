import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

// Requires auth so anonymous visitors can't use it to probe our quota usage.
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const [soniox, openrouter, supabaseStatus] = await Promise.all([
    checkSoniox(),
    checkOpenRouter(),
    checkSupabase(),
  ]);

  return NextResponse.json({ soniox, openrouter, supabase: supabaseStatus });
}

async function checkSoniox(): Promise<"connected" | "disconnected"> {
  const key = process.env.SONIOX_API_KEY;
  if (!key) return "disconnected";
  try {
    const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ usage_type: "transcribe_websocket", expires_in_seconds: 60 }),
    });
    return res.ok ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}

async function checkOpenRouter(): Promise<"connected" | "disconnected"> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return "disconnected";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}

async function checkSupabase(): Promise<"connected" | "disconnected"> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.from("settings").select("user_id").limit(1);
    return error ? "disconnected" : "connected";
  } catch {
    return "disconnected";
  }
}
