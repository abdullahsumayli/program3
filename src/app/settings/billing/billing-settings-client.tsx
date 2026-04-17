"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, isPaidPlan, type PlanId } from "@/lib/billing/plans";
import type { UsageSummary, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

export function BillingSettingsClient() {
  const { t, locale } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"cancel" | null>(null);
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
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  const isOwner = workspace.role === "owner";
  const paid = isPaidPlan(workspace.plan);
  const plan = PLANS[workspace.plan] ?? PLANS.free;
  const isActive = workspace.subscription_status === "active";
  const isExpired =
    workspace.subscription_status === "expired" ||
    workspace.subscription_status === "canceled";

  const minutesPct = usage.unlimited
    ? 0
    : Math.min(100, Math.round((usage.usedMinutes / usage.limitMinutes) * 100));
  const meetingsPct = usage.unlimited
    ? 0
    : Math.min(
        100,
        Math.round((usage.usedMeetings / usage.limitMeetings) * 100)
      );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          {t("billing.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {workspace.name} ·{" "}
          <Link
            href="/settings/workspace"
            className="text-blue-600 hover:underline"
          >
            {t("billing.workspaceSettingsLink")}
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isExpired && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">{t("billing.expiredBanner")}</p>
            <p className="mt-1">{t("billing.expiredBannerDetail")}</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("billing.currentPlan")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {plan.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                {paid
                  ? `${plan.priceSAR} ${t("billing.sarPerMonth")}`
                  : t("billing.freeLabel")}
              </span>
              <span>·</span>
              <StatusBadge status={workspace.subscription_status} t={t} />
            </div>
            {workspace.subscription_renews_at && paid && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar size={12} />
                {t("billing.renewsOn", {
                  date: new Date(
                    workspace.subscription_renews_at
                  ).toLocaleDateString(
                    locale === "ar" ? "ar-SA" : "en-US",
                    { year: "numeric", month: "long", day: "numeric" }
                  ),
                })}
              </div>
            )}
          </div>

          {isOwner && (
            <div className="flex gap-2">
              <Link href="/billing">
                <Button>
                  <CreditCard size={14} />
                  {paid ? t("billing.changePlan") : t("billing.upgrade")}
                </Button>
              </Link>
              {paid && isActive && (
                <Button
                  variant="outline"
                  onClick={cancelSubscription}
                  disabled={action !== null}
                >
                  {action === "cancel" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {t("billing.cancel")}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <UsageBar
            label={t("billing.minutesThisMonth")}
            used={usage.usedMinutes}
            limit={usage.unlimited ? -1 : usage.limitMinutes}
            unit={t("billing.minutes")}
            pct={minutesPct}
            unlimited={usage.unlimited}
          />
          <UsageBar
            label={t("billing.meetingsThisMonth")}
            used={usage.usedMeetings}
            limit={usage.unlimited ? -1 : usage.limitMeetings}
            unit={t("dashboard.meetings")}
            pct={meetingsPct}
            unlimited={usage.unlimited}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const p = PLANS[planId];
          const isCurrent = workspace.plan === planId;
          return (
            <div
              key={planId}
              className={`rounded-2xl border p-5 ${
                isCurrent
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    {p.name}
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {p.priceSAR}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      SAR
                    </span>
                  </div>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    {t("billing.current")}
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  {p.unlimited
                    ? t("billing.feature.unlimitedMeetings")
                    : t("billing.feature.meetings", {
                        count: p.monthlyMeetings,
                      })}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  {p.unlimited
                    ? t("billing.feature.unlimitedMinutes")
                    : t("billing.feature.minutes", {
                        count: p.monthlyMinutes,
                      })}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  {t("billing.feature.members", { count: p.maxMembers })}
                </li>
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  unit,
  pct,
  unlimited,
}: {
  label: string;
  used: number;
  limit: number;
  unit: string;
  pct: number;
  unlimited: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">
          {used} / {unlimited ? "∞" : limit} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full transition-all ${
            unlimited
              ? "bg-emerald-500"
              : pct >= 100
                ? "bg-red-500"
                : pct >= 80
                  ? "bg-amber-500"
                  : "bg-emerald-500"
          }`}
          style={{ width: unlimited ? "5%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    trial: "bg-blue-50 text-blue-700",
    expired: "bg-red-50 text-red-700",
    canceled: "bg-amber-50 text-amber-700",
    past_due: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {t(`billing.status.${status}`)}
    </span>
  );
}
