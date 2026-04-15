import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RecordingSession } from "@/lib/supabase/types";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!isAdminEmail(user.email)) {
    notFound();
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("recording_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message);
  }

  const sessions = (data ?? []) as RecordingSession[];
  const openSessions = sessions.filter(
    (session) => !session.ended_at && (session.status === "starting" || session.status === "recording")
  );
  const interruptedSessions = sessions.filter((session) => session.status === "interrupted");
  const errorSessions = sessions.filter((session) => session.status === "error");
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const attentionSessions = sessions.filter(
    (session) => session.status === "interrupted" || session.status === "error" || !session.ended_at
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
            Admin
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Recording Diagnostics</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Monitor recording health across customers. Sessions that stop unexpectedly or stop
            sending heartbeats will surface here even if the customer never explains the issue
            clearly in their support ticket.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          Signed in as <span className="font-medium text-gray-900">{user.email}</span>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Need Attention" value={attentionSessions.length} tone="red" />
        <SummaryCard label="Interrupted" value={interruptedSessions.length} tone="amber" />
        <SummaryCard label="Errors" value={errorSessions.length} tone="red" />
        <SummaryCard label="Completed" value={completedSessions.length} tone="green" />
      </div>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Attention Needed</h2>
          <p className="mt-1 text-sm text-gray-600">
            Interrupted sessions, explicit errors, or sessions that are still marked open. For open
            sessions, the heartbeat column tells you the last time the browser checked in.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <HeaderCell>User</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Started</HeaderCell>
                <HeaderCell>Heartbeat</HeaderCell>
                <HeaderCell>Duration</HeaderCell>
                <HeaderCell>Mode</HeaderCell>
                <HeaderCell>Retries</HeaderCell>
                <HeaderCell>Last Error</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {attentionSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                    No interrupted or stale sessions right now.
                  </td>
                </tr>
              ) : (
                attentionSessions.map((session) => (
                  <tr key={session.id} className="border-t border-gray-100 align-top">
                    <BodyCell>
                      <div className="font-medium text-gray-900">{session.user_email ?? session.user_id}</div>
                      <div className="mt-1 text-xs text-gray-500">{session.id}</div>
                    </BodyCell>
                    <BodyCell>
                      <StatusBadge status={session.ended_at ? session.status : "open"} />
                    </BodyCell>
                    <BodyCell>{formatDate(session.started_at)}</BodyCell>
                    <BodyCell>{formatDate(session.last_heartbeat_at)}</BodyCell>
                    <BodyCell>{formatDuration(session.duration_seconds)}</BodyCell>
                    <BodyCell>{session.recording_mode}</BodyCell>
                    <BodyCell>{session.interruption_count}</BodyCell>
                    <BodyCell>
                      <div className="max-w-sm whitespace-pre-wrap text-gray-700">
                        {session.last_error_message || "—"}
                      </div>
                      {session.last_error_status && (
                        <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                          {session.last_error_status}
                        </div>
                      )}
                    </BodyCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
          <p className="mt-1 text-sm text-gray-600">
            Last {sessions.length} captured recording sessions across all customers.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <HeaderCell>User</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Started</HeaderCell>
                <HeaderCell>Ended</HeaderCell>
                <HeaderCell>Duration</HeaderCell>
                <HeaderCell>Mode</HeaderCell>
                <HeaderCell>System Audio</HeaderCell>
                <HeaderCell>Meeting</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-t border-gray-100 align-top">
                  <BodyCell>
                    <div className="font-medium text-gray-900">{session.user_email ?? session.user_id}</div>
                    <div className="mt-1 text-xs text-gray-500">{session.id}</div>
                  </BodyCell>
                  <BodyCell>
                    <StatusBadge status={session.ended_at ? session.status : "open"} />
                  </BodyCell>
                  <BodyCell>{formatDate(session.started_at)}</BodyCell>
                  <BodyCell>{session.ended_at ? formatDate(session.ended_at) : "—"}</BodyCell>
                  <BodyCell>{formatDuration(session.duration_seconds)}</BodyCell>
                  <BodyCell>{session.recording_mode}</BodyCell>
                  <BodyCell>{session.system_audio_active ? "Active" : "Off"}</BodyCell>
                  <BodyCell>{session.meeting_id ?? "—"}</BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openSessions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {openSessions.length} session{openSessions.length === 1 ? "" : "s"} still look open. If
          the heartbeat is old and the customer says the recorder stopped, that usually means the
          tab closed, the browser crashed, or the network dropped before the session could close
          cleanly.
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${toneClass}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="px-5 py-3 font-medium">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-5 py-4 text-gray-700">{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "open"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : status === "interrupted"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
