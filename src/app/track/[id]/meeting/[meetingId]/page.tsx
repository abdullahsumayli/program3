import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MeetingDetail } from "@/components/meetings/meeting-detail";

const BUCKET = "meeting-audio";
const SIGNED_URL_TTL = 60 * 60; // 1h

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>;
}) {
  const { id, meetingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("user_id", user.id)
    .single();

  if (!meeting) notFound();

  // audio_url stores a storage path (e.g. "<user_id>/foo.webm").
  // Mint a short-lived signed URL so the private bucket stays private.
  let audioUrl: string | null = null;
  if (meeting.audio_url) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(meeting.audio_url, SIGNED_URL_TTL);
    audioUrl = data?.signedUrl ?? null;
  }

  return (
    <MeetingDetail
      meeting={{ ...meeting, audio_url: audioUrl }}
      trackId={id}
    />
  );
}
