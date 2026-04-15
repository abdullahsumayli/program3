"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/context";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, type AuthState } from "@/app/auth/actions";

type Mode = "signin" | "signup";

export function LoginForm() {
  const { t, locale, setLocale } = useLanguage();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const oauthError = searchParams.get("error");
  const [mode, setMode] = useState<Mode>("signin");

  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signInWithEmail : signUpWithEmail,
    null
  );

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Mic size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t("app.title")}</h1>
            <p className="text-xs text-slate-500">{t("app.subtitle")}</p>
          </div>
        </div>
        <button type="button" onClick={() => setLocale(locale === "en" ? "ar" : "en")} className="text-xs text-slate-500 hover:text-slate-700">
          {locale === "en" ? "العربية" : "English"}
        </button>
      </div>

      <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
        <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
          {t("auth.signIn")}
        </button>
        <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
          {t("auth.signUp")}
        </button>
      </div>

      <form action={signInWithGoogle} className="mb-4">
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="w-full justify-center">
          <GoogleIcon />
          {t("auth.continueWithGoogle")}
        </Button>
      </form>

      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        {t("auth.or")}
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t("auth.email")}</label>
          <Input type="email" name="email" required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">{t("auth.password")}</label>
          <Input type="password" name="password" required autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} placeholder="••••••••" />
          {mode === "signup" && <p className="mt-1 text-xs text-slate-500">{t("auth.passwordHint")}</p>}
        </div>

        {oauthError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{decodeURIComponent(oauthError)}</div>}
        {state?.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
        {state?.message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{state.message}</div>}

        <Button type="submit" className="w-full justify-center" disabled={pending}>
          {pending && <Loader2 size={14} className="animate-spin" />}
          {mode === "signin" ? t("auth.signIn") : t("auth.createAccount")}
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8L6.1 33C9.5 39.7 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.3 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
