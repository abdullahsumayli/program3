import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Workspace, Meeting } from "@/lib/supabase/types";
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

  const [membersRes, meetingsRes, tasksRes, usageRes, sessionsRes, usersRes] =
    await Promise.all([
      db.from("workspace_members").select("*").eq("workspace_id", id),
      db.from("meetings").select("id, title, duration, source_type, processing_status, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("meeting_tasks").select("id, status").eq("workspace_id", id),
      db.from("usage_counters").select("*").eq("workspace_id", id).maybeSingle(),
      db.from("recording_sessions").select("id, user_email, status, recording_mode, duration_seconds, started_at").eq("workspace_id", id).order("started_at", { ascending: false }).limit(20),
      db.auth.admin.listUsers({ perPage: 1000 }),
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
  const usage = usageRes.data as { seconds_used: number; period_start: string } | null;
  const sessions = (sessionsRes.data ?? []) as Array<{
    id: string;
    user_email: string | null;
    status: string;
    recording_mode: string;
    duration_seconds: number;
    started_at: string;
  }>;

  const totalMinutes = meetings.reduce((s, m) => s + Math.round((m.duration ?? 0) / 60), 0);
  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin" className="hover:text-gray-900">Customers</Link>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900">{ws.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{ws.name}</h1>
        <p className="mt-1 font-mono text-xs text-gray-400">{ws.id}</p>
      </div>

      <div className="space-y-8">
        {/* General Info */}
        <Card title="General Information">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField label="Owner" value={emailMap.get(ws.owner_id) ?? "—"} />
            <InfoField label="Plan" value={ws.plan === "paid" ? "Paid" : "Free"} />
            <InfoField
              label="Status"
              value={
                ws.subscription_status === "active"
                  ? "Active"
                  : ws.subscription_status === "past_due"
                    ? "Past Due"
                    : "Canceled"
              }
            />
            <InfoField label="Created" value={new Date(ws.created_at).toLocaleDateString()} />
            <InfoField
              label="Subscription Renews"
              value={ws.subscription_renews_at ? new Date(ws.subscription_renews_at).toLocaleDateString() : "—"}
            />
            <InfoField label="Members" value={String(members.length)} />
            <InfoField label="Meetings" value={String(meetings.length)} />
            <InfoField label="Tasks" value={`${tasksCompleted}/${tasks.length} completed`} />
          </div>
        </Card>

        {/* Usage */}
        <Card title="Usage">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UsageStat label="Total Meetings" value={meetings.length} />
            <UsageStat label="Total Minutes" value={totalMinutes} />
            <UsageStat label="Total Tasks" value={tasks.length} />
            <UsageStat
              label="Used This Period"
              value={usage ? Math.round(usage.seconds_used / 60) : 0}
              suffix="min"
            />
          </div>
        </Card>

        {/* Admin Actions (client component) */}
        <Card title="Admin Controls">
          <WorkspaceActions
            workspaceId={ws.id}
            currentPlan={ws.plan}
            currentStatus={ws.subscription_status}
            members={members}
          />
        </Card>

        {/* Recent Meetings */}
        <Card title="Recent Meetings">
          {meetings.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">No meetings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Source</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.slice(0, 15).map((m) => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">
                        {m.title || "Untitled"}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {Math.round((m.duration ?? 0) / 60)} min
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {m.source_type === "live_recording" ? "Live" : "Upload"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            m.processing_status === "completed"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : m.processing_status === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {m.processing_status}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Activity Log */}
        <Card title="Recent Recording Sessions">
          {sessions.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">No recording sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Mode</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 text-gray-900">{s.user_email ?? "—"}</td>
                      <td className="py-2.5 pr-4">
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
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{s.recording_mode}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {Math.round(s.duration_seconds / 60)} min
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {new Date(s.started_at).toLocaleString()}
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
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</dt>
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
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}
