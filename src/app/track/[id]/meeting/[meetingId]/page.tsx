import { redirect } from "next/navigation";

export default async function LegacyMeetingPage(props: PageProps<"/track/[id]/meeting/[meetingId]">) {
  const { meetingId } = await props.params;
  redirect(`/meetings/${meetingId}`);
}
