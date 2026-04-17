"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  Shield,
  Smartphone,
} from "lucide-react";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { useLanguage } from "@/lib/i18n/context";

const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "enterprise"];

export default function PricingPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          {t("pricing.title")}
        </h1>
        <p className="mt-3 text-lg text-slate-600">{t("pricing.subtitle")}</p>
      </div>

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

      <div className="mt-12 grid gap-6 md:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isPopular = planId === "pro";
          const features = getFeatures(planId, t);
          const isFree = planId === "free";

          return (
            <PricingCard
              key={planId}
              name={plan.name}
              price={plan.priceSAR}
              featured={isPopular}
              features={features}
              cta={
                isFree
                  ? t("pricing.ctaStartFree")
                  : t("pricing.ctaSubscribe")
              }
              ctaHref={isFree ? "/login" : "/billing"}
              popular={isPopular}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

function getFeatures(
  planId: PlanId,
  t: (key: string, params?: Record<string, string | number>) => string
): string[] {
  const plan = PLANS[planId];
  if (plan.unlimited) {
    return [
      t("billing.feature.unlimitedMeetings"),
      t("billing.feature.unlimitedMinutes"),
      t("billing.feature.members", { count: plan.maxMembers }),
      t("billing.feature.allFeatures"),
      t("billing.feature.prioritySupport"),
    ];
  }
  return [
    t("billing.feature.meetings", { count: plan.monthlyMeetings }),
    t("billing.feature.minutes", { count: plan.monthlyMinutes }),
    t("billing.feature.members", { count: plan.maxMembers }),
    t("billing.feature.allFeatures"),
  ];
}

function PricingCard({
  name,
  price,
  features,
  cta,
  ctaHref,
  featured,
  popular,
  t,
}: {
  name: string;
  price: number;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
  popular?: boolean;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`relative rounded-3xl border p-8 ${
        featured
          ? "border-blue-400 bg-gradient-to-br from-blue-50 to-white shadow-lg"
          : "border-slate-200 bg-white"
      }`}
    >
      {popular && (
        <div className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          {t("billing.popular")}
        </div>
      )}
      <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
        {name}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">{price}</span>
        <span className="text-sm text-slate-500">
          {t("pricing.sarPerMonth")}
        </span>
      </div>
      <ul className="mt-6 space-y-3 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2
              size={16}
              className="mt-0.5 flex-shrink-0 text-emerald-600"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 block rounded-lg px-4 py-3 text-center text-sm font-medium transition ${
          featured
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
