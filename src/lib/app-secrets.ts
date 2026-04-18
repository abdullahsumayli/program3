import { createAdminClient } from "@/lib/supabase/admin";

export const APP_SECRET_KEYS = [
  "SONIOX_API_KEY",
  "OPENROUTER_API_KEY",
  "MOYASAR_SECRET_KEY",
  "MOYASAR_PUBLISHABLE_KEY",
  "MOYASAR_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
] as const;

export type AppSecretKey = (typeof APP_SECRET_KEYS)[number];

type SecretRow = {
  key: AppSecretKey;
  value: string;
  updated_at: string;
};

export function isAppSecretKey(key: string): key is AppSecretKey {
  return (APP_SECRET_KEYS as readonly string[]).includes(key);
}

export async function getAppSecret(key: AppSecretKey): Promise<string | null> {
  const secrets = await getAppSecrets([key]);
  return secrets[key] ?? null;
}

export async function getAppSecrets(
  keys: readonly AppSecretKey[] = APP_SECRET_KEYS
): Promise<Partial<Record<AppSecretKey, string>>> {
  const resolved: Partial<Record<AppSecretKey, string>> = {};

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_secrets")
      .select("key,value")
      .in("key", [...keys]);

    for (const row of (data ?? []) as SecretRow[]) {
      resolved[row.key] = row.value;
    }
  } catch {
    // The migration may not be applied yet; fall back to environment variables.
  }

  for (const key of keys) {
    if (!resolved[key] && process.env[key]) {
      resolved[key] = process.env[key];
    }
  }

  return resolved;
}

export async function listAppSecretStatuses() {
  const dbValues: Partial<Record<AppSecretKey, SecretRow>> = {};

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_secrets")
      .select("key,value,updated_at")
      .in("key", [...APP_SECRET_KEYS]);

    for (const row of (data ?? []) as SecretRow[]) {
      dbValues[row.key] = row;
    }
  } catch {
    // Return env-derived state if app_secrets has not been migrated yet.
  }

  return APP_SECRET_KEYS.map((key) => ({
    key,
    configured: Boolean(dbValues[key]?.value || process.env[key]),
    source: dbValues[key]?.value ? "admin" : process.env[key] ? "env" : null,
    updated_at: dbValues[key]?.updated_at ?? null,
  }));
}

export async function upsertAppSecrets(
  values: Partial<Record<AppSecretKey, string>>,
  userId: string
) {
  const rows = Object.entries(values)
    .filter((entry): entry is [AppSecretKey, string] => {
      const [key, value] = entry;
      return isAppSecretKey(key) && typeof value === "string" && value.trim().length > 0;
    })
    .map(([key, value]) => ({
      key,
      value: value.trim(),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { count: 0, error: null };

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_secrets")
    .upsert(rows, { onConflict: "key" });

  return { count: rows.length, error };
}
