import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  return NextResponse.json({
    isAdmin: isAdminEmail(auth.user.email),
    email: auth.user.email ?? null,
  });
}
