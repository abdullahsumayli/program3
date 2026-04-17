"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

type PaymentStatus = "loading" | "paid" | "failed" | "unknown";

async function resolvePaymentStatus(
  paymentId: string | null,
  urlStatus: string | null
): Promise<PaymentStatus> {
  if (urlStatus === "paid") return "paid";
  if (urlStatus === "failed") return "failed";
  if (!paymentId) return "unknown";

  try {
    const res = await fetch(
      `/api/billing/verify?id=${encodeURIComponent(paymentId)}`
    );
    if (!res.ok) return "unknown";
    const body = await res.json();
    if (body.status === "paid") return "paid";
    if (body.status === "failed") return "failed";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function BillingCallbackClient() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const paymentId = searchParams.get("id");
  const urlStatus = searchParams.get("status");

  const [statusPromise] = useState(() =>
    resolvePaymentStatus(paymentId, urlStatus)
  );
  const status = use(statusPromise);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="animate-spin text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">
              {t("billing.callback.verifying")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("billing.callback.pleaseWait")}
            </p>
          </div>
        )}

        {status === "paid" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("billing.callback.successTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("billing.callback.successDescription")}
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/">
                <Button>{t("billing.callback.goToDashboard")}</Button>
              </Link>
              <Link href="/settings/billing">
                <Button variant="outline">
                  {t("billing.callback.viewSubscription")}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <XCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("billing.callback.failedTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("billing.callback.failedDescription")}
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/billing">
                <Button>{t("billing.callback.tryAgain")}</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">
                  {t("billing.callback.goToDashboard")}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === "unknown" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
              <Loader2 size={40} className="text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("billing.callback.processingTitle")}
            </h2>
            <p className="text-sm text-slate-500">
              {t("billing.callback.processingDescription")}
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/settings/billing">
                <Button>{t("billing.callback.viewSubscription")}</Button>
              </Link>
              <Link href="/">
                <Button variant="outline">
                  {t("billing.callback.goToDashboard")}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
