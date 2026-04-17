"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  workspaceId: string;
  currentPlan: string;
  currentStatus: string;
  currentMeetingLimitOverride: number | null;
  members: Array<{ user_id: string; email: string; role: string }>;
};

type MeetingLimitMode = "plan" | "custom" | "unlimited";

export default function WorkspaceActions({
  workspaceId,
  currentPlan,
  currentStatus,
  currentMeetingLimitOverride,
  members,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [meetingLimitMode, setMeetingLimitMode] = useState<MeetingLimitMode>(
    getMeetingLimitMode(currentMeetingLimitOverride)
  );
  const [customMeetingLimit, setCustomMeetingLimit] = useState(
    currentMeetingLimitOverride && currentMeetingLimitOverride > 0
      ? String(currentMeetingLimitOverride)
      : "10"
  );

  async function doAction(body: Record<string, unknown>) {
    setFeedback(null);
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: "err", msg: json.error ?? "فشلت العملية" });
      return;
    }
    setFeedback({ type: "ok", msg: "تم بنجاح" });
    startTransition(() => router.refresh());
  }

  async function doDelete() {
    if (!confirm("هل أنت متأكد من حذف هذه الشركة وجميع بياناتها نهائياً؟")) return;
    setFeedback(null);
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: "err", msg: json.error ?? "فشلت العملية" });
      return;
    }
    router.push("/admin");
  }

  async function removeMember(userId: string, email: string) {
    if (!confirm(`هل تريد إزالة ${email} من هذه الشركة؟`)) return;
    await doAction({ action: "remove_member", user_id: userId });
  }

  async function saveMeetingLimitOverride() {
    let limit: number | null = null;

    if (meetingLimitMode === "unlimited") {
      limit = -1;
    }

    if (meetingLimitMode === "custom") {
      const parsed = Number(customMeetingLimit);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setFeedback({ type: "err", msg: "أدخل حد اجتماعات صحيح أكبر من صفر" });
        return;
      }
      limit = parsed;
    }

    await doAction({ action: "set_meeting_limit_override", limit });
  }

  const roleLabel = (role: string) => {
    if (role === "owner") return "مالك";
    if (role === "admin") return "مدير";
    return "عضو";
  };

  return (
    <div className="space-y-8">
      {/* رسالة النتيجة */}
      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            feedback.type === "ok"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* إدارة الاشتراك */}
      <Section title="إدارة الاشتراك">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <ActionButton
              label="تغيير الباقة"
              disabled={isPending}
              onClick={() => {
                const plans = ["free", "basic", "pro", "enterprise"];
                const next = plans[(plans.indexOf(currentPlan) + 1) % plans.length];
                doAction({ action: "change_plan", plan: next });
              }}
            />
            <span className="self-center text-xs text-gray-500">الحالي: {currentPlan}</span>
            {currentStatus !== "active" && (
              <ActionButton
                label="تفعيل"
                tone="green"
                disabled={isPending}
                onClick={() => doAction({ action: "change_status", status: "active" })}
              />
            )}
            {currentStatus === "active" && (
              <ActionButton
                label="إيقاف"
                tone="amber"
                disabled={isPending}
                onClick={() => doAction({ action: "change_status", status: "canceled" })}
              />
            )}
            <ActionButton
              label="تمديد 30 يوم"
              disabled={isPending}
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 30);
                doAction({ action: "extend_subscription", renews_at: d.toISOString() });
              }}
            />
          </div>

          <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[minmax(180px,220px)_minmax(140px,180px)_auto] md:items-end">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                حد الاجتماعات الشهري
              </span>
              <select
                value={meetingLimitMode}
                disabled={isPending}
                onChange={(event) => setMeetingLimitMode(event.target.value as MeetingLimitMode)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
              >
                <option value="plan">حسب الباقة</option>
                <option value="custom">حد مخصص</option>
                <option value="unlimited">مفتوح</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                عدد الاجتماعات
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={customMeetingLimit}
                disabled={isPending || meetingLimitMode !== "custom"}
                onChange={(event) => setCustomMeetingLimit(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
              />
            </label>

            <ActionButton
              label="حفظ حد الاجتماعات"
              disabled={isPending}
              onClick={saveMeetingLimitOverride}
            />
          </div>
        </div>
      </Section>

      {/* التحكم بالاستهلاك */}
      <Section title="التحكم بالاستهلاك">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="تصفير الاستخدام"
            tone="amber"
            disabled={isPending}
            onClick={() => {
              if (!confirm("هل تريد تصفير كل الاستخدام؟")) return;
              doAction({ action: "reset_usage" });
            }}
          />
          <ActionButton
            label="إضافة 60 دقيقة"
            disabled={isPending}
            onClick={() => doAction({ action: "add_minutes", minutes: 60 })}
          />
          <ActionButton
            label="إضافة 300 دقيقة"
            disabled={isPending}
            onClick={() => doAction({ action: "add_minutes", minutes: 300 })}
          />
        </div>
      </Section>

      {/* الأعضاء */}
      <Section title="الأعضاء">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium tracking-wider text-gray-500">
                <th className="px-4 py-2.5">البريد الإلكتروني</th>
                <th className="px-4 py-2.5">الصلاحية</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {roleLabel(m.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    {m.role !== "owner" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeMember(m.user_id, m.email)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        إزالة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* منطقة الخطر */}
      <Section title="منطقة الخطر">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-sm text-red-700">
            حذف هذه الشركة نهائياً مع جميع البيانات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={doDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            حذف الشركة
          </button>
        </div>
      </Section>
    </div>
  );
}

function getMeetingLimitMode(limit: number | null): MeetingLimitMode {
  if (limit === -1) return "unlimited";
  if (typeof limit === "number" && limit > 0) return "custom";
  return "plan";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold tracking-wider text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone?: "green" | "amber";
  disabled?: boolean;
  onClick: () => void;
}) {
  const cls =
    tone === "green"
      ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
