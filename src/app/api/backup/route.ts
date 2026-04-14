import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  // Only export THIS user's data. RLS would already filter, but we scope
  // explicitly so imports can't reassign rows to other users.
  const [tracks, meetings, tags, meetingTags, settings] = await Promise.all([
    supabase.from("tracks").select("*").eq("user_id", user.id),
    supabase.from("meetings").select("*").eq("user_id", user.id),
    supabase.from("tags").select("*").eq("user_id", user.id),
    supabase
      .from("meeting_tags")
      .select("meeting_id, tag_id, meetings!inner(user_id)")
      .eq("meetings.user_id", user.id),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ]);

  return NextResponse.json({
    version: 2,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    tracks: tracks.data ?? [],
    meetings: meetings.data ?? [],
    tags: tags.data ?? [],
    meeting_tags:
      (meetingTags.data ?? []).map((r: { meeting_id: string; tag_id: string }) => ({
        meeting_id: r.meeting_id,
        tag_id: r.tag_id,
      })),
    settings: settings.data ?? null,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const data = await request.json();

  // Force every row to belong to the current user, regardless of what's in the file.
  const withOwner = <T extends object>(rows: T[]) =>
    rows.map((r) => ({ ...r, user_id: user.id }));

  if (Array.isArray(data.tracks) && data.tracks.length > 0) {
    await supabase.from("tracks").upsert(withOwner(data.tracks));
  }
  if (Array.isArray(data.meetings) && data.meetings.length > 0) {
    await supabase.from("meetings").upsert(withOwner(data.meetings));
  }
  if (Array.isArray(data.tags) && data.tags.length > 0) {
    await supabase.from("tags").upsert(withOwner(data.tags));
  }
  if (Array.isArray(data.meeting_tags) && data.meeting_tags.length > 0) {
    await supabase.from("meeting_tags").upsert(data.meeting_tags);
  }
  if (data.settings) {
    const { ...rest } = data.settings;
    delete (rest as Record<string, unknown>).user_id;
    await supabase
      .from("settings")
      .upsert({ ...rest, user_id: user.id }, { onConflict: "user_id" });
  }

  return NextResponse.json({ ok: true });
}
