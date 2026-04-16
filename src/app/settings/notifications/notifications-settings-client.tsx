"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export function NotificationsSettingsClient() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.notifications.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.notifications.description")}</p>

        <div className="mt-6 space-y-4">
          <NotificationRow
            icon={<Mail size={18} />}
            title={t("settings.notifications.emailTitle")}
            description={t("settings.notifications.emailDescription")}
            enabled={false}
            comingSoon={false}
          />
          <NotificationRow
            icon={<MessageCircle size={18} />}
            title={t("settings.notifications.whatsappTitle")}
            description={t("settings.notifications.whatsappDescription")}
            enabled={false}
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}

function NotificationRow({
  icon,
  title,
  description,
  enabled,
  comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  comingSoon?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      {comingSoon ? (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {t("settings.comingSoon")}
        </span>
      ) : (
        <button
          type="button"
          className={`relative h-6 w-11 rounded-full transition-colors ${
            enabled ? "bg-slate-900" : "bg-slate-200"
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      )}
    </div>
  );
}
