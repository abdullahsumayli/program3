import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  APP_SECRET_KEYS,
  isAppSecretKey,
  listAppSecretStatuses,
  upsertAppSecrets,
  type AppSecretKey,
} from "@/lib/app-secrets";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json({ keys: await listAppSecretStatuses() });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawValues = body.values;
  if (!rawValues || typeof rawValues !== "object") {
    return NextResponse.json({ error: "values required" }, { status: 400 });
  }

  const values: Partial<Record<AppSecretKey, string>> = {};
  for (const [key, value] of Object.entries(rawValues as Record<string, unknown>)) {
    if (!isAppSecretKey(key)) continue;
    if (typeof value === "string" && value.trim()) {
      values[key] = value;
    }
  }

  const { count, error } = await upsertAppSecrets(values, auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updated: count,
    keys: APP_SECRET_KEYS,
  });
}
