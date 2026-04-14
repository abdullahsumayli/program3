"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Download, Upload } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/context";

type HealthStatus = "checking" | "connected" | "disconnected";
type HealthData = { soniox: HealthStatus; openrouter: HealthStatus; supabase: HealthStatus };

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, setLocale } = useLanguage();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<HealthData>({
    soniox: "checking",
    openrouter: "checking",
    supabase: "checking",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.system_prompt) setSystemPrompt(data.system_prompt);
      })
      .catch(() => {});

    setHealth({ soniox: "checking", openrouter: "checking", supabase: "checking" });
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch(() =>
        setHealth({ soniox: "disconnected", openrouter: "disconnected", supabase: "disconnected" })
      );
  }, [open]);

  const savePrompt = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    const res = await fetch("/api/backup");
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meetings-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    window.location.reload();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("settings.title")} className="max-w-lg">
      <div className="space-y-6">
        {/* Connection check */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            {t("settings.connectionCheck")}
          </h3>
          <div className="space-y-2 rounded-lg border border-gray-200 p-3">
            <HealthRow label="Soniox" status={health.soniox} t={t} />
            <HealthRow label="OpenRouter (Claude)" status={health.openrouter} t={t} />
            <HealthRow label="Supabase" status={health.supabase} t={t} />
          </div>
        </section>

        {/* Language */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("settings.language")}</h3>
          <div className="flex gap-2">
            <Button
              variant={locale === "en" ? "primary" : "outline"}
              size="sm"
              onClick={() => setLocale("en")}
            >
              {t("settings.languageEn")}
            </Button>
            <Button
              variant={locale === "ar" ? "primary" : "outline"}
              size="sm"
              onClick={() => setLocale("ar")}
            >
              {t("settings.languageAr")}
            </Button>
          </div>
        </section>

        {/* System prompt */}
        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            {t("settings.systemPrompt")}
          </h3>
          <p className="mb-2 text-xs text-gray-500">{t("settings.systemPromptHelp")}</p>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={savePrompt} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("settings.save")}
            </Button>
            {saved && <span className="text-xs text-green-600">{t("settings.saved")}</span>}
          </div>
        </section>

        {/* Backup */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t("settings.backup")}</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download size={14} />
              {t("settings.exportData")}
            </Button>
            <label>
              <input type="file" accept=".json" className="hidden" onChange={importData} />
              <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Upload size={14} />
                {t("settings.importData")}
              </span>
            </label>
          </div>
        </section>
      </div>
    </Dialog>
  );
}

function HealthRow({
  label,
  status,
  t,
}: {
  label: string;
  status: HealthStatus;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{label}</span>
      <span className="flex items-center gap-1.5">
        {status === "checking" && (
          <>
            <Loader2 size={14} className="animate-spin text-gray-400" />
            <span className="text-gray-500">{t("settings.checking")}</span>
          </>
        )}
        {status === "connected" && (
          <>
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-green-600">{t("settings.connected")}</span>
          </>
        )}
        {status === "disconnected" && (
          <>
            <XCircle size={14} className="text-red-600" />
            <span className="text-red-600">{t("settings.disconnected")}</span>
          </>
        )}
      </span>
    </div>
  );
}
