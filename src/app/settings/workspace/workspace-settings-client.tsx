"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkspaceMember, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

type Member = Pick<WorkspaceMember, "user_id" | "role" | "created_at">;

export function WorkspaceSettingsClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, membersRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/workspaces/members", { cache: "no-store" }),
      ]);
      if (dashRes.ok) {
        const body = await dashRes.json();
        setWorkspace(body.workspace ?? null);
      }
      if (membersRes.ok) setMembers(await membersRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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
          <Link
            href="/settings/users"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            {t("workspace.settings.manageTeam")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
