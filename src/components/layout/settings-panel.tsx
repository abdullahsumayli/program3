"use client";

import { Loader2, RefreshCw, Settings, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

type ServiceStatus = {
  configured: boolean;
  connected: boolean;
  label: string;
};

type HealthPayload = {
  ok: boolean;
  services: {
    supabase: ServiceStatus;
    soniox: ServiceStatus;
    openrouter: ServiceStatus;
  };
};

export function SettingsPanel() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Health check failed");
      }

      const payload = (await response.json()) as HealthPayload;
      setHealth(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  };

  const openAndCheck = async () => {
    setOpen(true);
    if (!health && !loading) {
      await runHealthCheck();
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => void openAndCheck()} aria-label={t("settings.title")}>
        <Settings size={16} />
        <span className="hidden sm:inline">{t("settings.title")}</span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <ShieldCheck size={18} />
                  <h2 className="text-lg font-semibold">{t("settings.title")}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">{t("settings.subtitle")}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label={t("common.cancel")}>
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{t("settings.connectionStatus")}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {health
                      ? health.ok
                        ? t("settings.allConnected")
                        : t("settings.connectionIssues")
                      : t("settings.checkPrompt")}
                  </div>
                </div>
                <Button onClick={() => void runHealthCheck()} disabled={loading} className="justify-center">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {t("settings.testConnection")}
                </Button>
              </div>

              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

              <div className="grid gap-3">
                <ServiceRow title="Supabase" status={health?.services.supabase ?? null} />
                <ServiceRow title="Soniox" status={health?.services.soniox ?? null} />
                <ServiceRow title="OpenRouter" status={health?.services.openrouter ?? null} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ServiceRow({ title, status }: { title: string; status: ServiceStatus | null }) {
  const { t } = useLanguage();
  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;
  const tone = !status
    ? "border-slate-200 bg-white text-slate-500"
    : connected
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : configured
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  const badge = !status
    ? t("settings.statusNotChecked")
    : connected
      ? t("settings.statusConnected")
      : configured
        ? t("settings.statusConfiguredOnly")
        : t("settings.statusMissingKey");

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm opacity-90">{status?.label ?? t("settings.serviceCheckHint")}</div>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">{badge}</span>
      </div>
    </div>
  );
}
