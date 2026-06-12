"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceInvite, WorkspaceMember, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

type Member = Pick<WorkspaceMember, "user_id" | "role" | "created_at">;
type Invite = Pick<WorkspaceInvite, "id" | "email" | "phone" | "role" | "token" | "expires_at" | "accepted_at">;

export function UsersSettingsClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const linkFor = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  const createLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNewLink(null);
    try {
      const res = await fetch("/api/workspaces/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Failed");
      setNewLink(linkFor(body.token));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/workspaces/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (newLink) setNewLink(null);
    await load();
  };

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
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const isOwner = workspace.role === "owner";
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const pendingInvites = invites.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.users.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.users.description")}</p>

        <ul className="mt-5 divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                  {m.user_id.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{m.user_id.slice(0, 8)}</div>
                  <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {m.role}
                  </span>
                </div>
              </div>
              {isOwner && m.role !== "owner" && (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value as "admin" | "member")}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("settings.users.inviteTitle")}</h2>
          <form onSubmit={createLink} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {t("settings.users.roleLabel")}
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {t("settings.users.createLink")}
            </Button>
          </form>

          {newLink && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-medium text-emerald-700">{t("settings.users.linkReady")}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={newLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <Button type="button" onClick={() => copy(newLink, "new")}>
                  {copiedId === "new" ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === "new" ? t("settings.users.copied") : t("settings.users.copyLink")}
                </Button>
              </div>
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700">{t("settings.users.pendingInvites")}</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-700">{linkFor(invite.token)}</div>
                      <div className="text-xs text-slate-500">
                        {invite.role} · {t("settings.users.expiresOn", {
                          date: new Date(invite.expires_at).toLocaleDateString(),
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => copy(linkFor(invite.token), invite.id)}>
                        {copiedId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === invite.id ? t("settings.users.copied") : t("settings.users.copyLink")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
