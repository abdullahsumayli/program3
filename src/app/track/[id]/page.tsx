import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrackView } from "@/components/tracks/track-view";

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: track } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!track) notFound();

  return <TrackView track={track} />;
}
