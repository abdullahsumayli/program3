"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings as SettingsIcon, Languages, Mic, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { SettingsModal } from "@/components/layout/settings-modal";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/");

  useEffect(() => {
    if (isAuthPage) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, [isAuthPage]);

  if (isAuthPage) return null;

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Mic size={18} />
            </div>
            <span className="text-lg font-semibold text-gray-900">{t("app.title")}</span>
          </Link>

          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden max-w-[180px] truncate text-xs text-gray-500 sm:inline">
                {email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              aria-label="Toggle language"
            >
              <Languages size={16} />
              <span className="hidden sm:inline">
                {locale === "en" ? "العربية" : "English"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label={t("settings.title")}
            >
              <SettingsIcon size={18} />
            </Button>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                aria-label={t("auth.signOut")}
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">{t("auth.signOut")}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
