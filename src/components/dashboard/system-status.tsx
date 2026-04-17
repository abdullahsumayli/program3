"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";

type HealthPayload = {
  ok: boolean;
  services: {
    supabase: { configured: boolean; connected: boolean };
    soniox: { configured: boolean; connected: boolean };
    openrouter: { configured: boolean; connected: boolean };
  };
};

export function SystemStatus() {
  const { t } = useLanguage();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (res.ok && !cancelled) {
          setHealth(await res.json());
        } else if (!cancelled) {
          setHealth(null);
        }
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-300 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-300" />
        </span>
        {t("status.checking")}
      </div>
    );
  }

  const ok = health?.ok ?? false;

  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${ok ? "text-emerald-700" : "text-red-600"}`}>
      <span className="relative flex h-2.5 w-2.5">
        {ok && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      {ok ? t("status.ready") : t("status.issue")}
    </div>
  );
}
