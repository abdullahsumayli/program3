"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, isPaidPlan, type PlanId } from "@/lib/billing/plans";
import type { UsageSummary, WorkspaceSummary } from "@/lib/supabase/types";
import { useLanguage } from "@/lib/i18n/context";

const PLAN_ORDER: PlanId[] = ["basic", "pro", "enterprise"];

type PlanFeature = { text: string; highlighted?: boolean };

function getPlanFeatures(
  planId: PlanId,
  t: (key: string, params?: Record<string, string | number>) => string
): PlanFeature[] {
  const plan = PLANS[planId];
  if (plan.unlimited) {
    return [
      { text: t("billing.feature.unlimitedMeetings"), highlighted: true },
      { text: t("billing.feature.unlimitedMinutes"), highlighted: true },
      {
        text: t("billing.feature.members", { count: plan.maxMembers }),
      },
      { text: t("billing.feature.allFeatures") },
      { text: t("billing.feature.prioritySupport"), highlighted: true },
    ];
  }
  return [
    {
      text: t("billing.feature.meetings", { count: plan.monthlyMeetings }),
    },
    {
      text: t("billing.feature.minutes", {
        count: plan.monthlyMinutes,
      }),
    },
    {
      text: t("billing.feature.members", { count: plan.maxMembers }),
    },
    { text: t("billing.feature.allFeatures") },
  ];
}

export function BillingPageClient() {
  const { t } = useLanguage();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
    void load();
  }, []);

  const handleSubscribe = async (planId: PlanId) => {
    setCheckoutPlan(planId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
      if (body.redirectUrl) {
        try {
          const url = new URL(body.redirectUrl);
          if (url.hostname.endsWith("moyasar.com") || url.hostname.endsWith("moyasar.sa")) {
            window.location.href = body.redirectUrl;
            return;
          }
        } catch { /* invalid URL */ }
        throw new Error("Invalid payment URL");
      }
      throw new Error("No payment URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const currentPlan = workspace?.plan ?? "free";
  const isCurrentPaid = isPaidPlan(currentPlan);
  const isActive = workspace?.subscription_status === "active";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} />
          {t("meeting.back")}
        </Link>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t("billing.choosePlan")}
        </h1>
        <p className="mt-2 text-base text-slate-500">
          {t("billing.choosePlanSubtitle")}
        </p>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <CreditCard size={14} /> {t("billing.method.card")}
        </span>
        <span className="flex items-center gap-1.5">
          <Shield size={14} /> {t("billing.method.mada")}
        </span>
        <span className="flex items-center gap-1.5">
          <Smartphone size={14} /> {t("billing.method.applePay")}
        </span>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrent = currentPlan === planId && isActive;
          const isPopular = planId === "pro";
          const features = getPlanFeatures(planId, t);
          const isUpgrade =
            !isCurrent &&
            PLAN_ORDER.indexOf(planId) >
              PLAN_ORDER.indexOf(currentPlan as PlanId);
          const isDowngrade =
            isCurrentPaid &&
            PLAN_ORDER.indexOf(planId) <
              PLAN_ORDER.indexOf(currentPlan as PlanId);

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-2xl border p-6 transition ${
                isPopular
                  ? "border-blue-400 bg-gradient-to-br from-blue-50 to-white shadow-lg ring-1 ring-blue-200"
                  : "border-slate-200 bg-white"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  {t("billing.popular")}
                </div>
              )}

              <div>
                <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
                  {plan.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">
                    {plan.priceSAR}
                  </span>
                  <span className="text-sm text-slate-500">
                    {t("billing.sarPerMonth")}
                  </span>
                </div>
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <CheckCircle2
                      size={16}
                      className={`mt-0.5 flex-shrink-0 ${
                        f.highlighted
                          ? "text-blue-600"
                          : "text-emerald-600"
                      }`}
                    />
                    <span
                      className={
                        f.highlighted
                          ? "font-medium text-slate-900"
                          : "text-slate-700"
                      }
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-3 text-sm font-medium text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    {t("billing.currentPlan")}
                  </div>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                  >
                    {t("billing.contactToDowngrade")}
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      isPopular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : ""
                    }`}
                    onClick={() => handleSubscribe(planId)}
                    disabled={checkoutPlan !== null}
                  >
                    {checkoutPlan === planId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    {isUpgrade
                      ? t("billing.upgradeNow")
                      : t("billing.subscribeNow")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {usage && (
        <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("billing.currentUsage")}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {usage.usedMeetings}
                <span className="text-base font-normal text-slate-400">
                  /{usage.unlimited ? "∞" : usage.limitMeetings}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {t("billing.meetingsUsed")}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {usage.usedMinutes}
                <span className="text-base font-normal text-slate-400">
                  /{usage.unlimited ? "∞" : usage.limitMinutes}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {t("billing.minutesUsed")}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">
        {t("billing.securePayment")}
      </p>
    </div>
  );
}
