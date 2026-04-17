"use client";

import { useState } from "react";

type ServiceStatus = "idle" | "checking" | "connected" | "configured" | "missing";

type ServiceInfo = {
  id: string;
  name: string;
  description: string;
  envVars: string[];
  docsUrl: string;
  icon: React.ReactNode;
};

const KEY_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

const SERVICES: ServiceInfo[] = [
  {
    id: "soniox",
    name: "Soniox",
    description: "محرك تحويل الكلام إلى نص — التفريغ المباشر وتفريغ الملفات المرفوعة.",
    envVars: ["SONIOX_API_KEY"],
    docsUrl: "https://soniox.com",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "تحليل الاجتماعات بالذكاء الاصطناعي — الملخص، القرارات، والمهام.",
    envVars: ["OPENROUTER_API_KEY"],
    docsUrl: "https://openrouter.ai",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "قاعدة البيانات، المصادقة، وتخزين الملفات الصوتية.",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    docsUrl: "https://supabase.com",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    id: "moyasar",
    name: "Moyasar",
    description: "بوابة الدفع — Visa، مدى، Apple Pay.",
    envVars: ["MOYASAR_SECRET_KEY", "MOYASAR_PUBLISHABLE_KEY", "MOYASAR_WEBHOOK_SECRET"],
    docsUrl: "https://moyasar.com",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    id: "resend",
    name: "Resend",
    description: "خدمة البريد الإلكتروني — تذكيرات المهام ودعوات الفريق.",
    envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    docsUrl: "https://resend.com",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
];

type HealthResponse = {
  ok: boolean;
  services: Record<string, { configured: boolean; connected: boolean; label: string }>;
};

export function AdminApiKeysClient() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setTested(false);

    const checking: Record<string, ServiceStatus> = {};
    for (const svc of SERVICES) checking[svc.id] = "checking";
    setStatuses(checking);

    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error("Health check failed");
      const data: HealthResponse = await res.json();

      const newStatuses: Record<string, ServiceStatus> = {};
      const newLabels: Record<string, string> = {};

      for (const svc of SERVICES) {
        const info = data.services[svc.id];
        if (!info) {
          newStatuses[svc.id] = "idle";
          newLabels[svc.id] = "لم يتم الفحص";
          continue;
        }
        if (info.connected) {
          newStatuses[svc.id] = "connected";
        } else if (info.configured) {
          newStatuses[svc.id] = "configured";
        } else {
          newStatuses[svc.id] = "missing";
        }
        newLabels[svc.id] = info.label;
      }

      setStatuses(newStatuses);
      setLabels(newLabels);
      setTested(true);
    } catch {
      const failed: Record<string, ServiceStatus> = {};
      for (const svc of SERVICES) failed[svc.id] = "idle";
      setStatuses(failed);
    } finally {
      setTesting(false);
    }
  };

  const connectedCount = SERVICES.filter((s) => statuses[s.id] === "connected").length;
  const missingCount = SERVICES.filter((s) => statuses[s.id] === "missing").length;
  const configuredOnlyCount = SERVICES.filter((s) => statuses[s.id] === "configured").length;
  const allConnected = tested && connectedCount === SERVICES.length;

  return (
    <>
      {/* العنوان */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
            {KEY_ICON}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">مفاتيح API</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              المفاتيح والخدمات الخارجية المرتبطة بتشغيل المنصة.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {testing ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          )}
          فحص الاتصال
        </button>
      </div>

      {/* الملخص */}
      {tested && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-xl border px-5 py-4 ${
            allConnected
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          {allConnected ? (
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          <div>
            <div className={`text-sm font-semibold ${allConnected ? "text-green-800" : "text-amber-800"}`}>
              {allConnected
                ? "جميع الخدمات متصلة وتعمل بشكل طبيعي."
                : `${connectedCount} من ${SERVICES.length} متصل${missingCount > 0 ? ` · ${missingCount} مفتاح ناقص` : ""}${configuredOnlyCount > 0 ? ` · ${configuredOnlyCount} مُعد ولكن غير متصل` : ""}`}
            </div>
          </div>
        </div>
      )}

      {!tested && !testing && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-500">
          اضغط على &quot;فحص الاتصال&quot; للتأكد من صحة جميع المفاتيح وأن الخدمات تعمل.
        </div>
      )}

      {/* كروت الخدمات */}
      <div className="space-y-4">
        {SERVICES.map((svc) => (
          <ServiceCard
            key={svc.id}
            service={svc}
            status={statuses[svc.id] ?? "idle"}
            label={labels[svc.id] ?? ""}
            tested={tested}
          />
        ))}
      </div>
    </>
  );
}

function ServiceCard({
  service,
  status,
  label,
  tested,
}: {
  service: ServiceInfo;
  status: ServiceStatus;
  label: string;
  tested: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300">
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            {service.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{service.name}</span>
              <a
                href={service.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{service.description}</p>
          </div>
        </div>

        <div className="shrink-0">
          {status === "checking" ? (
            <Badge color="blue" icon={<Spinner />} text="جارٍ الفحص..." />
          ) : !tested ? (
            <Badge color="gray" icon={<DotIcon />} text="لم يُفحص" />
          ) : status === "connected" ? (
            <Badge color="green" icon={<CheckIcon />} text="متصل" />
          ) : status === "configured" ? (
            <Badge color="amber" icon={<WarnIcon />} text="معد — غير متصل" />
          ) : (
            <Badge color="red" icon={<XIcon />} text="المفتاح ناقص" />
          )}
        </div>
      </div>

      {/* المتغيرات والتفاصيل */}
      <div className="border-t border-gray-100 px-6 py-3 flex flex-wrap items-center gap-2">
        {service.envVars.map((v) => (
          <code
            key={v}
            className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-500"
          >
            {v}
          </code>
        ))}
        {tested && label && status !== "connected" && (
          <span className="text-[11px] text-gray-400">— {label}</span>
        )}
      </div>
    </div>
  );
}

function Badge({
  color,
  icon,
  text,
}: {
  color: "green" | "amber" | "red" | "gray" | "blue";
  icon: React.ReactNode;
  text: string;
}) {
  const styles = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    gray: "border-gray-200 bg-gray-50 text-gray-500",
    blue: "border-blue-200 bg-blue-50 text-blue-600",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${styles[color]}`}>
      {icon}
      {text}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function DotIcon() {
  return <span className="h-2 w-2 rounded-full bg-gray-400" />;
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
