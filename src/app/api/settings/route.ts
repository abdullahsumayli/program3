import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  // The signup trigger creates a row, but upsert covers any edge case
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    const { data: created } = await supabase
      .from("settings")
      .insert({ user_id: user.id })
      .select()
      .single();
    return NextResponse.json(created);
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;
  if (body.language !== undefined) updates.language = body.language;

  const { data, error } = await supabase
    .from("settings")
    .upsert(updates, { onConflict: "user_id" })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
