"use client";

import { Mail, MessageCircle, Hash } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export function IntegrationsSettingsClient() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t("settings.integrations.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("settings.integrations.description")}</p>

        <div className="mt-6 space-y-4">
          <IntegrationRow
            icon={<MessageCircle size={18} />}
            name="WhatsApp"
            description={t("settings.integrations.whatsappDescription")}
          />
          <IntegrationRow
            icon={<Mail size={18} />}
            name="Email"
            description={t("settings.integrations.emailDescription")}
          />
          <IntegrationRow
            icon={<Hash size={18} />}
            name="Slack"
            description={t("settings.integrations.slackDescription")}
          />
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        {t("settings.comingSoon")}
      </span>
    </div>
  );
}
