import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { PLANS } from "@/lib/billing/plans";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export async function GET() {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace, user } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cleanRole = ["admin", "member"].includes(body.role as string) ? (body.role as string) : "member";
  const cleanEmail =
    typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase() : null;

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
  // Open reusable link: long-lived so the team can keep using one link.
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();

  // email is a non-null sentinel for open links (the DB column is NOT NULL on
  // the live schema, and acceptance is link-based so the value is unused).
  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspace.id,
      email: cleanEmail ?? "open-link",
      role: cleanRole,
      token,
      invited_by: user.id,
      expires_at,
    })
    .select("id, token")
    .single();

  if (error || !invite) return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });

  const acceptUrl = `${getBaseUrl(request)}/invite/${token}`;

  return NextResponse.json({
    id: invite.id,
    token: invite.token,
    acceptUrl,
  });
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
