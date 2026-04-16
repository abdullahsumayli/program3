"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/context";
import type { WorkspaceSummary } from "@/lib/supabase/types";

export function CompanySettingsClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.ok) {
          const body = await res.json();
          setWorkspace(body.workspace ?? null);
          setName(body.workspace?.name ?? "");
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !workspace) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Building2 size={18} className="text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("settings.company.title")}</h2>
            <p className="text-sm text-slate-500">{t("settings.company.description")}</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("settings.company.nameLabel")}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("settings.company.planLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {workspace.planName}
              </span>
              <span className="text-sm text-slate-500">
                {workspace.subscription_status}
              </span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
