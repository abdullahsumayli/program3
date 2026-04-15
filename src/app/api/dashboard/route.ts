import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getUsageSummary } from "@/lib/meetings";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const usage = await getUsageSummary(supabase, user.id);

  const [{ data: meetings, error: meetingsError }, { data: decisions, error: decisionsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from("meetings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("meeting_decisions").select("*, meetings(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("meeting_tasks").select("*, meetings(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (meetingsError || decisionsError || tasksError) {
    return NextResponse.json({ error: meetingsError?.message ?? decisionsError?.message ?? tasksError?.message ?? "Failed to load dashboard" }, { status: 500 });
  }

  return NextResponse.json({
    usage,
    meetings: meetings ?? [],
    decisions: (decisions ?? []).map((decision) => ({ ...decision, meeting_title: decision.meetings?.title ?? null })),
    tasks: (tasks ?? []).map((task) => ({ ...task, meeting_title: task.meetings?.title ?? null })),
  });
}
