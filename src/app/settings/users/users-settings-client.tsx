"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Loader2, MessageCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);
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

  const acceptUrlFor = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  const whatsappUrl = (phone: string | null, token: string) => {
    const message = t("settings.users.inviteMessage", {
      workspace: workspace?.name ?? "",
      url: acceptUrlFor(token),
    });
    const target = phone ? phone : "";
    return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
  };

  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    // Open a tab synchronously so the popup is tied to the user gesture; we set
    // its destination once the invite is created.
    const pending = window.open("", "_blank");
    try {
      const res = await fetch("/api/workspaces/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: invitePhone.trim() || undefined, role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Failed");

      const waUrl = whatsappUrl(body.phone ?? null, body.token);
      if (pending) pending.location.href = waUrl;
      else window.open(waUrl, "_blank");

      setInvitePhone("");
      await load();
    } catch (err) {
      if (pending) pending.close();
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (invite: Invite) => {
    try {
      await navigator.clipboard.writeText(acceptUrlFor(invite.token));
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((current) => (current === invite.id ? null : current)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/workspaces/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
        <h2 className="text-lg font-semibold text-slate-900">
          {t("settings.users.title")}
        </h2>
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
          <form onSubmit={sendInvite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {t("settings.users.whatsappLabel")}
              </label>
              <Input
                type="tel"
                inputMode="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="9665XXXXXXXX"
              />
            </div>
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
            <Button type="submit" disabled={sending} className="bg-[#25D366] text-white hover:bg-[#1ebe5d]">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              {t("settings.users.sendWhatsapp")}
            </Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">{t("settings.users.whatsappHint")}</p>

          {pendingInvites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700">{t("settings.users.pendingInvites")}</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {invite.phone ? `+${invite.phone}` : invite.email ?? t("settings.users.inviteTitle")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {invite.role} · {t("settings.users.expiresOn", {
                          date: new Date(invite.expires_at).toLocaleDateString(),
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={whatsappUrl(invite.phone, invite.token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#1ebe5d]"
                      >
                        <MessageCircle size={13} />
                        {t("settings.users.resend")}
                      </a>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(invite)}>
                        {copiedId === invite.id ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)}>
                        <X size={14} />
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
