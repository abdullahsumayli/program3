import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/context";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = body.token;
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  // Open invite links: anyone who opens the link and signs in joins. The token
  // is the capability — we don't require the invite email to match the user,
  // and the link stays reusable so several teammates can join with one link.
  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("workspace_invites")
    .select("id, workspace_id, role, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }

  const { error: memberError } = await admin
    .from("workspace_members")
    .upsert(
      { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role },
      { onConflict: "workspace_id,user_id" }
    );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const workspaceId = invite.workspace_id as string;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ workspaceId });
}
