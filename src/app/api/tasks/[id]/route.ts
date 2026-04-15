import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { id } = await ctx.params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.description !== undefined) updates.description = body.description;
  if (body.owner_name !== undefined) updates.owner_name = body.owner_name;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.status !== undefined) updates.status = body.status;

  const { data, error } = await supabase
    .from("meeting_tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
