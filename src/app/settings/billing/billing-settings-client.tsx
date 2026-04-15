"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";
import type { UsageSummary, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

export function BillingSettingsClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"checkout" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        setWorkspace(body.workspace ?? null);
        setUsage(body.usage ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCheckout = async () => {
    setAction("checkout");
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
      if (body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      throw new Error("No payment URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setAction(null);
    }
  };

  const cancelSubscription = async () => {
    if (!confirm(t("billing.confirmCancel"))) return;
    setAction("cancel");
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Cancel failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setAction(null);
    }
  };

  if (loading || !workspace || !usage) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">{t("common.loading")}</div>;
  }

  const isOwner = workspace.role === "owner";
  const isPaid = workspace.plan === "paid";
  const usedPct = Math.min(100, Math.round((usage.usedMinutes / usage.limitMinutes) * 100));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{t("billing.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {workspace.name} ·{" "}
        <Link href="/settings/workspace" className="text-blue-600 hover:underline">
          {t("billing.workspaceSettingsLink")}
        </Link>
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("billing.currentPlan")}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{workspace.planName}</div>
            <div className="mt-1 text-sm text-slate-500">
              {isPaid ? `${PLANS.paid.priceSAR} ${t("billing.sarPerMonth")}` : t("billing.freeLabel")} ·{" "}
              {t("billing.statusLabel")} {workspace.subscription_status}
            </div>
          </div>
          {isOwner ? (
            <div className="flex gap-2">
              {!isPaid ? (
                <Button onClick={startCheckout} disabled={action !== null}>
                  {action === "checkout" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {t("billing.upgrade")}
                </Button>
              ) : workspace.subscription_status === "active" ? (
                <Button variant="outline" onClick={cancelSubscription} disabled={action !== null}>
                  {action === "cancel" ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t("billing.cancel")}
                </Button>
              ) : (
                <Button onClick={startCheckout} disabled={action !== null}>
                  {action === "checkout" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {t("billing.renew")}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-700">{t("billing.usageThisMonth")}</span>
            <span className="font-medium text-slate-900">
              {usage.usedMinutes} / {usage.limitMinutes} {t("billing.minutes")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full ${usedPct >= 100 ? "bg-red-500" : usedPct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {t("billing.minutesRemaining", { count: usage.remainingMinutes })}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <PlanCard
          name={t("billing.planFree")}
          price={PLANS.free.priceSAR}
          minutes={PLANS.free.monthlyMinutes}
          members={PLANS.free.maxMembers}
          current={!isPaid}
        />
        <PlanCard
          name={t("billing.planPaid")}
          price={PLANS.paid.priceSAR}
          minutes={PLANS.paid.monthlyMinutes}
          members={PLANS.paid.maxMembers}
          current={isPaid}
        />
      </section>
    </div>
  );
}

function PlanCard({
  name,
  price,
  minutes,
  members,
  current,
}: {
  name: string;
  price: number;
  minutes: number;
  members: number;
  current: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${current ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{name}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {price} <span className="text-sm font-normal text-slate-500">SAR / month</span>
          </div>
        </div>
        {current ? (
          <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white">Current</span>
        ) : null}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-600" />
          {minutes.toLocaleString()} minutes / month
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-600" />
          Up to {members} {members === 1 ? "member" : "members"}
        </li>
      </ul>
    </div>
  );
}
