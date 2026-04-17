import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/client";
import { taskDueSoonEmail } from "@/lib/email/templates";

// Vercel Cron daily endpoint — finds meeting_tasks whose due_date is tomorrow
// and emails an assignee (when the owner_name is an email address).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

  const { data: tasks, error } = await supabase
    .from("meeting_tasks")
    .select("id, description, owner_name, due_date, meetings(title)")
    .eq("status", "in_progress")
    .gte("due_date", tomorrow.toISOString().slice(0, 10))
    .lt("due_date", dayAfter.toISOString().slice(0, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const task of tasks ?? []) {
    const owner = task.owner_name?.trim();
    if (!owner || !owner.includes("@")) continue;

    type MeetingRef = { title: string | null } | null;
    const meeting = (task as unknown as { meetings: MeetingRef }).meetings;
    const meetingTitle = meeting?.title ?? "Meeting";

    const { subject, html } = taskDueSoonEmail({
      taskDescription: task.description,
      meetingTitle,
      dueDate: task.due_date as string,
      appUrl,
    });

    try {
      await sendEmail({ to: owner, subject, html });
      sent++;
    } catch (err) {
      console.error("[cron/task-reminders] send failed", err);
    }
  }

  return NextResponse.json({ sent, total: tasks?.length ?? 0 });
}
