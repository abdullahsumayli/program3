import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MeetingDetail } from "@/components/meetings/meeting-detail";

const BUCKET = "meeting-audio";
const SIGNED_URL_TTL = 60 * 60;

export default async function MeetingPage(props: PageProps<"/meetings/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!meeting) notFound();

  const [{ data: decisions }, { data: tasks }] = await Promise.all([
    supabase.from("meeting_decisions").select("*").eq("meeting_id", id).eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("meeting_tasks").select("*").eq("meeting_id", id).eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  let audioUrl: string | null = null;
  if (meeting.audio_url) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(meeting.audio_url, SIGNED_URL_TTL);
    audioUrl = data?.signedUrl ?? null;
  }

  return <MeetingDetail meeting={{ ...meeting, audio_url: audioUrl }} decisions={decisions ?? []} tasks={tasks ?? []} />;
}
