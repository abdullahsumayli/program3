/**
 * Canonical public base URL for OAuth redirects, invite links, payment callbacks, etc.
 * Prefer NEXT_PUBLIC_APP_URL (set on Vercel) so redirects never depend on a missing Origin header.
 */
export function getPublicAppUrlFromEnv(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
}
