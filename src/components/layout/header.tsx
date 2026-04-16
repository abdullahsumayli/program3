"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages, LogOut, Mic, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();
  const [email, setEmail] = useState<string | null>(null);

  const isAuthPage = pathname === "/login" || pathname.startsWith("/auth/");

  useEffect(() => {
    if (isAuthPage) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [isAuthPage]);

  if (isAuthPage) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Mic size={16} />
          </div>
          <span className="text-sm font-semibold text-slate-900">{t("app.title")}</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {email && (
            <span className="hidden max-w-[180px] truncate rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500 sm:inline">
              {email}
            </span>
          )}
          <Link href="/settings">
            <Button variant="ghost" size="sm" aria-label={t("settings.title")}>
              <Settings size={16} />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            aria-label="Toggle language"
          >
            <Languages size={16} />
            <span className="hidden sm:inline">{locale === "en" ? "العربية" : "English"}</span>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" aria-label={t("auth.signOut")}>
              <LogOut size={16} />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
