"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "accepting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setStatus("accepting");
    setError(null);
    try {
      const res = await fetch("/api/workspaces/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setStatus("done");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{t("invite.title")}</h1>
      <p className="mt-3 text-sm text-slate-600">{t("invite.description")}</p>
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      <Button
        onClick={accept}
        disabled={status === "accepting" || status === "done"}
        className="mt-6"
        size="lg"
      >
        {status === "accepting" ? t("common.loading") : t("invite.acceptButton")}
      </Button>
    </div>
  );
}
