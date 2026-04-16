"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, CreditCard, Bell, Puzzle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { key: "company", icon: Building2, href: "/settings" },
  { key: "users", icon: Users, href: "/settings/users" },
  { key: "billing", icon: CreditCard, href: "/settings/billing" },
  { key: "notifications", icon: Bell, href: "/settings/notifications" },
  { key: "integrations", icon: Puzzle, href: "/settings/integrations" },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (href: string) => {
    if (href === "/settings") {
      return pathname === "/settings" || pathname === "/settings/workspace";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">{t("settings.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("settings.subtitle")}</p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <nav className="w-full shrink-0 lg:w-56">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {t(`settings.nav.${item.key}`)}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
