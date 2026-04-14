import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Meeting counts per track (RLS limits rows to this user's)
  const { data: counts } = await supabase
    .from("meetings")
    .select("track_id")
    .eq("user_id", user.id);

  const countMap = new Map<string, number>();
  counts?.forEach((m) => {
    countMap.set(m.track_id, (countMap.get(m.track_id) ?? 0) + 1);
  });

  const withCounts = tracks?.map((t) => ({
    ...t,
    meeting_count: countMap.get(t.id) ?? 0,
  }));

  return NextResponse.json(withCounts ?? []);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { name, type } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const trackType = type === "lectures" ? "lectures" : "meetings";

  const { data, error } = await supabase
    .from("tracks")
    .insert({ name: name.trim(), type: trackType, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("tracks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
