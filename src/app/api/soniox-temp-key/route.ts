import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { enforceQuota } from "@/lib/billing/enforce";

const SONIOX_TEMP_KEY_TTL_SECONDS = 3600;

// Issues a short-lived Soniox temporary API key. Requires the caller to be
// authenticated (and within quota) so anonymous visitors can't drain the
// Soniox quota.
export async function POST() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const blocked = await enforceQuota(supabase, workspace);
  if (blocked) return blocked;

  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SONIOX_API_KEY missing" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_type: "transcribe_websocket",
        expires_in_seconds: SONIOX_TEMP_KEY_TTL_SECONDS,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Soniox error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ api_key: data.api_key ?? data.temporary_api_key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
