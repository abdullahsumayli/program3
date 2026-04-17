import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const email = searchParams.get("email");
  const limit = Number(searchParams.get("limit") ?? "100");

  const supabase = createAdminClient();
  let query = supabase
    .from("recording_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100);

  if (status) query = query.eq("status", status);
  if (email) query = query.ilike("user_email", `%${email}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
