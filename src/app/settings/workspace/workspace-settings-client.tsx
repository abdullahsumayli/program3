"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceInvite, WorkspaceMember, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

type Member = Pick<WorkspaceMember, "user_id" | "role" | "created_at">;
type Invite = Pick<WorkspaceInvite, "id" | "email" | "role" | "expires_at" | "accepted_at">;

export function WorkspaceSettingsClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, membersRes, invitesRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/workspaces/members", { cache: "no-store" }),
        fetch("/api/workspaces/invites", { cache: "no-store" }),
      ]);
      if (dashRes.ok) {
        const body = await dashRes.json();
        setWorkspace(body.workspace ?? null);
      }
      if (membersRes.ok) setMembers(await membersRes.json());
      if (invitesRes.ok) setInvites(await invitesRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Failed");
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/workspaces/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  };

  const memberLabel = (m: Member) => m.user_id.slice(0, 8);

  const removeMember = async (userId: string) => {
    await fetch(`/api/workspaces/members?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    await load();
  };

  const changeRole = async (userId: string, role: "admin" | "member") => {
    await fetch("/api/workspaces/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    await load();
  };

  if (loading || !workspace) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">{t("common.loading")}</div>;
  }

  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const isOwner = workspace.role === "owner";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{workspace.name}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t("workspace.settings.planLine", { planName: workspace.planName, status: workspace.subscription_status })}
      </p>
      <div className="mt-3">
        <Link href="/settings/billing" className="text-sm font-medium text-blue-600 hover:underline">
          {t("workspace.settings.manageBilling")}
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("workspace.settings.members", { count: members.length })}</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-mono text-xs text-slate-500" title={m.user_id}>
                  {memberLabel(m)}
                </div>
                <div className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {m.role}
                </div>
              </div>
              {isOwner && m.role !== "owner" ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as "admin" | "member")}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("workspace.settings.inviteTitle")}</h2>
          <form onSubmit={sendInvite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-slate-500">{t("workspace.settings.emailLabel")}</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">{t("workspace.settings.roleLabel")}</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {t("workspace.settings.inviteButton")}
            </Button>
          </form>

          {invites.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700">{t("workspace.settings.pendingInvites")}</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {invites
                  .filter((i) => !i.accepted_at)
                  .map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium">{invite.email}</div>
                        <div className="text-xs text-slate-500">
                          {invite.role} ·{" "}
                          {t("workspace.settings.expiresOn", { date: new Date(invite.expires_at).toLocaleDateString() })}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)}>
                        <X size={14} />
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
