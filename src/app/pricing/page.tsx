 "use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PLANS } from "@/lib/billing/plans";
import { useLanguage } from "@/lib/i18n/context";

export default function PricingPage() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{t("pricing.title")}</h1>
        <p className="mt-3 text-lg text-slate-600">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <PricingCard
          name={PLANS.free.name}
          price={PLANS.free.priceSAR}
          features={[
            `${PLANS.free.monthlyMinutes} minutes of transcription per month`,
            `${PLANS.free.maxMembers} workspace member`,
            "All summarization features",
            "Arabic and English support",
          ]}
          cta={t("pricing.ctaStartFree")}
          ctaHref="/login"
        />
        <PricingCard
          name={PLANS.paid.name}
          price={PLANS.paid.priceSAR}
          featured
          features={[
            `${PLANS.paid.monthlyMinutes.toLocaleString()} minutes of transcription per month`,
            `Up to ${PLANS.paid.maxMembers} workspace members`,
            "Role-based access (owner/admin/member)",
            "Email notifications and reminders",
            "Priority support",
          ]}
          cta={t("pricing.ctaUpgrade")}
          ctaHref="/settings/billing"
        />
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  features,
  cta,
  ctaHref,
  featured,
}: {
  name: string;
  price: number;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`rounded-3xl border p-8 ${
        featured ? "border-blue-400 bg-gradient-to-br from-blue-50 to-white shadow-lg" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-sm font-medium uppercase tracking-wide text-slate-500">{name}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-slate-900">{price}</span>
        <span className="text-sm text-slate-500">{t("pricing.sarPerMonth")}</span>
      </div>
      <ul className="mt-6 space-y-3 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 block rounded-lg px-4 py-3 text-center text-sm font-medium transition ${
          featured ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
