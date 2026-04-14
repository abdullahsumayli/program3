import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { id } = await params;
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
