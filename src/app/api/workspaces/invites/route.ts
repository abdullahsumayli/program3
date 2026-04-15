import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { PLANS } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/client";
import { workspaceInviteEmail } from "@/lib/email/templates";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET() {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, expires_at, accepted_at, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace, user } = auth;

  const { email, role } = await request.json();
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const cleanRole = ["admin", "member"].includes(role) ? role : "member";
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const plan = PLANS[workspace.plan];
  const { count, error: countError } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) >= plan.maxMembers) {
    return NextResponse.json(
      { error: "plan_member_limit", message: `Plan allows up to ${plan.maxMembers} members.` },
      { status: 402 }
    );
  }

  const token = generateToken();
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspace.id,
      email: cleanEmail,
      role: cleanRole,
      token,
      invited_by: user.id,
      expires_at,
    })
    .select()
    .single();

  if (error || !invite) return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const acceptUrl = `${appUrl}/invite/${token}`;
  const { subject, html } = workspaceInviteEmail({
    workspaceName: workspace.name,
    inviterName: user.email ?? "A teammate",
    acceptUrl,
  });

  try {
    await sendEmail({ to: cleanEmail, subject, html });
  } catch (err) {
    console.error("[invite] email send failed", err);
  }

  return NextResponse.json({ id: invite.id, acceptUrl });
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { searchParams } = new URL(request.url);
  const inviteId = searchParams.get("id");
  if (!inviteId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
