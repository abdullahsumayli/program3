import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Workspace } from "@/lib/supabase/types";

type WorkspaceRow = Workspace & {
  member_count: number;
  meeting_count: number;
  total_minutes: number;
  last_activity: string | null;
  owner_email: string;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const db = createAdminClient();

  const wsQuery = db.from("workspaces").select("*").order("created_at", { ascending: false });
  if (q) wsQuery.ilike("name", `%${q}%`);
  const { data: workspaces } = await wsQuery;
  const ws = (workspaces ?? []) as Workspace[];

  const wsIds = ws.map((w) => w.id);

  const [membersRes, meetingsRes, usersRes] = await Promise.all([
    db.from("workspace_members").select("workspace_id").in("workspace_id", wsIds),
    db.from("meetings").select("workspace_id, duration, created_at").in("workspace_id", wsIds),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailMap = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, u.email ?? "—"])
  );

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    memberCounts.set(m.workspace_id, (memberCounts.get(m.workspace_id) ?? 0) + 1);
  }

  const meetingStats = new Map<string, { count: number; minutes: number; lastActivity: string | null }>();
  for (const m of meetingsRes.data ?? []) {
    const prev = meetingStats.get(m.workspace_id) ?? { count: 0, minutes: 0, lastActivity: null };
    prev.count++;
    prev.minutes += Math.round((m.duration ?? 0) / 60);
    if (!prev.lastActivity || m.created_at > prev.lastActivity) {
      prev.lastActivity = m.created_at;
    }
    meetingStats.set(m.workspace_id, prev);
  }

  const rows: WorkspaceRow[] = ws.map((w) => ({
    ...w,
    owner_email: emailMap.get(w.owner_id) ?? "—",
    member_count: memberCounts.get(w.id) ?? 0,
    meeting_count: meetingStats.get(w.id)?.count ?? 0,
    total_minutes: meetingStats.get(w.id)?.minutes ?? 0,
    last_activity: meetingStats.get(w.id)?.lastActivity ?? null,
  }));

  const totalUsers = [...memberCounts.values()].reduce((a, b) => a + b, 0);
  const activeCount = rows.filter((r) => r.subscription_status === "active").length;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">العملاء</h1>
        <p className="mt-1 text-sm text-gray-500">
          إدارة جميع الشركات والاشتراكات والاستهلاك.
        </p>
      </div>

      {/* الإحصائيات */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي الشركات" value={rows.length} />
        <StatCard label="نشط" value={activeCount} tone="green" />
        <StatCard label="إجمالي المستخدمين" value={totalUsers} />
        <StatCard
          label="إجمالي الاجتماعات"
          value={rows.reduce((s, r) => s + r.meeting_count, 0)}
        />
      </div>

      {/* البحث */}
      <form action="/admin" method="GET" className="mb-6">
        <div className="relative max-w-md">
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="ابحث باسم الشركة..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
      </form>

      {/* الجدول */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium tracking-wider text-gray-500">
                <th className="px-5 py-3">الشركة</th>
                <th className="px-5 py-3">المستخدمين</th>
                <th className="px-5 py-3">الباقة</th>
                <th className="px-5 py-3">الحالة</th>
                <th className="px-5 py-3">تاريخ التسجيل</th>
                <th className="px-5 py-3">آخر نشاط</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    {q ? "لا توجد نتائج مطابقة للبحث." : "لا توجد شركات."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="mt-0.5 text-xs text-gray-400">{r.owner_email}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{r.member_count}</td>
                    <td className="px-5 py-4">
                      <PlanBadge plan={r.plan} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.subscription_status} />
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {r.last_activity
                        ? new Date(r.last_activity).toLocaleDateString("ar-SA")
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-left">
                      <Link
                        href={`/admin/workspaces/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        التفاصيل
                        <svg className="h-3 w-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-medium tracking-wider text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone === "green" ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === "paid"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-gray-200 bg-gray-50 text-gray-600";
  const label = plan === "paid" ? "مدفوعة" : "مجانية";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "past_due"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";
  const label =
    status === "active" ? "نشط" : status === "past_due" ? "متأخر" : "موقوف";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
