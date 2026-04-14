import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  // Escape LIKE wildcards to prevent pattern injection
  const safe = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pattern = `%${safe}%`;

  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, track_id, title, summary")
    .eq("user_id", user.id)
    .or(
      `title.ilike.${pattern},transcript.ilike.${pattern},summary.ilike.${pattern},notes.ilike.${pattern}`
    )
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const trackIds = [...new Set(meetings?.map((m) => m.track_id) ?? [])];
  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, name")
    .eq("user_id", user.id)
    .in("id", trackIds);
  const trackMap = new Map(tracks?.map((t) => [t.id, t.name]) ?? []);

  const results = meetings?.map((m) => ({
    ...m,
    track_name: trackMap.get(m.track_id) ?? "",
  }));

  return NextResponse.json(results ?? []);
}
