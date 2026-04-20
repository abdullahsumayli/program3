import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Workspace, Meeting } from "@/lib/supabase/types";
import { getUsageSummary } from "@/lib/meetings";
import { getPlan } from "@/lib/billing/plans";
import { getMeetingLimitOverride } from "@/lib/billing/meeting-limit-overrides";
import { getMonthlyFreeMinuteGrant } from "@/lib/billing/minute-grants";
import WorkspaceActions from "./workspace-actions";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: wsData } = await db
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (!wsData) notFound();
  const ws = wsData as Workspace;

  const [
    membersRes,
    meetingsRes,
    tasksRes,
    sessionsRes,
    usersRes,
    meetingLimitOverride,
    freeMinuteGrant,
  ] =
    await Promise.all([
      db.from("workspace_members").select("*").eq("workspace_id", id),
      db.from("meetings").select("id, title, duration, source_type, processing_status, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("meeting_tasks").select("id, status").eq("workspace_id", id),
      db.from("recording_sessions").select("id, user_email, status, recording_mode, duration_seconds, started_at").eq("workspace_id", id).order("started_at", { ascending: false }).limit(20),
      db.auth.admin.listUsers({ perPage: 1000 }),
      getMeetingLimitOverride(db, id),
      ws.plan === "free" ? getMonthlyFreeMinuteGrant(db, id) : Promise.resolve(0),
    ]);

  const emailMap = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? "—"])
  );

  const members = (membersRes.data ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as string,
    email: emailMap.get(m.user_id) ?? "—",
    created_at: m.created_at as string,
  }));

  const meetings = (meetingsRes.data ?? []) as Pick<
    Meeting,
    "id" | "title" | "duration" | "source_type" | "processing_status" | "created_at"
  >[];

  const tasks = (tasksRes.data ?? []) as Array<{ id: string; status: string }>;
  const sessions = (sessionsRes.data ?? []) as Array<{
    id: string;
    user_email: string | null;
    status: string;
    recording_mode: string;
    duration_seconds: number;
    started_at: string;
  }>;

  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const planConfig = getPlan(ws.plan);
  const usageSummary = await getUsageSummary(
    db,
    id,
    ws.plan,
    meetingLimitOverride,
    freeMinuteGrant
  );
  const meetingLimitLabel =
    meetingLimitOverride === -1
      ? "مفتوح"
      : meetingLimitOverride
        ? `${meetingLimitOverride} شهرياً`
        : planConfig.unlimited
          ? "مفتوح حسب الباقة"
          : `${planConfig.monthlyMeetings} حسب الباقة`;

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = { active: "نشط", trial: "تجريبي", expired: "منتهي", canceled: "ملغي", past_due: "متأخر" };
    return labels[s] ?? s;
  };

  const processingLabel = (s: string) =>
    s === "completed" ? "مكتمل" : s === "error" ? "خطأ" : "قيد المعالجة";

  const sessionStatusLabel = (s: string) =>
    s === "completed" ? "مكتمل" : s === "recording" ? "يسجل" : s === "error" ? "خطأ" : "متوقف";

  return (
    <>
      {/* مسار التنقل */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-gray-900">العملاء</Link>
        <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900">{ws.name}</span>
      </div>

      {/* العنوان */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{ws.name}</h1>
        <p className="mt-1 font-mono text-xs text-gray-400">{ws.id}</p>
      </div>

      <div className="space-y-8">
        {/* معلومات عامة */}
        <Card title="المعلومات العامة">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField label="المالك" value={emailMap.get(ws.owner_id) ?? "—"} />
            <InfoField label="الباقة" value={ws.plan === "free" ? "مجانية" : ws.plan} />
            <InfoField label="الحالة" value={statusLabel(ws.subscription_status)} />
            <InfoField label="تاريخ الإنشاء" value={new Date(ws.created_at).toLocaleDateString("ar-SA")} />
            <InfoField
              label="تجديد الاشتراك"
              value={ws.subscription_renews_at ? new Date(ws.subscription_renews_at).toLocaleDateString("ar-SA") : "—"}
            />
            <InfoField label="حد الاجتماعات الشهري" value={meetingLimitLabel} />
            <InfoField
              label="حد الدقائق الشهري"
              value={
                usageSummary.minutesUnlimited
                  ? "مفتوح"
                  : `${usageSummary.limitMinutes} دقيقة`
              }
            />
            <InfoField label="الأعضاء" value={String(members.length)} />
            <InfoField label="الاجتماعات" value={String(meetings.length)} />
            <InfoField label="المهام" value={`${tasksCompleted}/${tasks.length} مكتملة`} />
          </div>
        </Card>

        {/* الاستهلاك */}
        <Card title="الاستهلاك">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageStat label="اجتماعات هذا الشهر" value={usageSummary.usedMeetings} />
            <UsageStat label="إجمالي المهام" value={tasks.length} />
            <UsageStat
              label="الدقائق المستهلكة"
              value={usageSummary.usedMinutes}
              suffix="دقيقة"
            />
            <UsageStat
              label="الدقائق غير المستهلكة"
              value={usageSummary.minutesUnlimited ? "∞" : usageSummary.remainingMinutes}
              suffix="دقيقة"
            />
            <UsageStat
              label="رصيد الدقائق الإضافية"
              value={usageSummary.monthlyExtraMinutes}
              suffix="دقيقة"
            />
            <UsageStat
              label="المستهلك من الرصيد الإضافي"
              value={usageSummary.monthlyExtraMinutesUsed}
              suffix="دقيقة"
            />
            <UsageStat
              label="المتبقي من الرصيد الإضافي"
              value={usageSummary.monthlyExtraMinutesRemaining}
              suffix="دقيقة"
            />
          </div>
        </Card>

        {/* تحكم الأدمن */}
        <Card title="تحكم الأدمن">
          <WorkspaceActions
            key={`${ws.id}:${meetingLimitOverride ?? "plan"}:${freeMinuteGrant}`}
            workspaceId={ws.id}
            currentPlan={ws.plan}
            currentStatus={ws.subscription_status}
            currentMeetingLimitOverride={meetingLimitOverride}
            currentFreeMinuteGrant={freeMinuteGrant}
            members={members}
          />
        </Card>

        {/* آخر الاجتماعات */}
        <Card title="آخر الاجتماعات">
          {meetings.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">لا توجد اجتماعات بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-right text-xs font-medium tracking-wider text-gray-500">
                    <th className="pb-2 pl-4">العنوان</th>
                    <th className="pb-2 pl-4">المدة</th>
                    <th className="pb-2 pl-4">المصدر</th>
                    <th className="pb-2 pl-4">الحالة</th>
                    <th className="pb-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.slice(0, 15).map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2.5 pl-4 font-medium text-gray-900">
                        {m.title || "بدون عنوان"}
                      </td>
                      <td className="py-2.5 pl-4 text-gray-600">
                        {Math.round((m.duration ?? 0) / 60)} دقيقة
                      </td>
                      <td className="py-2.5 pl-4 text-gray-600">
                        {m.source_type === "live_recording" ? "مباشر" : "رفع ملف"}
                      </td>
                      <td className="py-2.5 pl-4">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            m.processing_status === "completed"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : m.processing_status === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {processingLabel(m.processing_status)}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(m.created_at).toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* سجل التسجيلات */}
        <Card title="سجل جلسات التسجيل">
          {sessions.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">لا توجد جلسات تسجيل.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-right text-xs font-medium tracking-wider text-gray-500">
                    <th className="pb-2 pl-4">المستخدم</th>
                    <th className="pb-2 pl-4">الحالة</th>
                    <th className="pb-2 pl-4">الوضع</th>
                    <th className="pb-2 pl-4">المدة</th>
                    <th className="pb-2">البداية</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2.5 pl-4 text-gray-900">{s.user_email ?? "—"}</td>
                      <td className="py-2.5 pl-4">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            s.status === "completed"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : s.status === "recording"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : s.status === "error"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {sessionStatusLabel(s.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4 text-gray-600">
                        {s.recording_mode === "mic-only" ? "ميكروفون" : "مشاركة شاشة"}
                      </td>
                      <td className="py-2.5 pl-4 text-gray-600">
                        {Math.round(s.duration_seconds / 60)} دقيقة
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(s.started_at).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function UsageStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-xs font-medium tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">
        {value}
        {suffix && <span className="mr-1 text-sm font-normal text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}
