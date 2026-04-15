import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.error) return auth;

  if (!isAdminEmail(auth.user.email)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) as NextResponse,
    };
  }

  return auth;
}
