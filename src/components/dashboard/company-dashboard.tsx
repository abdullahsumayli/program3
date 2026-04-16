"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Loader2,
  Mic,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordingSession } from "@/components/recording/recording-session";
import { SystemStatus } from "@/components/dashboard/system-status";
import { useLanguage } from "@/lib/i18n/context";
import type { DashboardData, MeetingTask, TaskStatus } from "@/lib/supabase/types";

export function CompanyDashboard() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = await response.json();
      setData(payload);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", uploadFile);
      formData.append("title", uploadTitle);
      const response = await fetch("/api/meetings/upload", { method: "POST", body: formData });
      if (!response.ok) {
        throw new Error((await response.json()).error ?? "Upload failed");
      }
      setUploadTitle("");
      setUploadFile(null);
      setShowUpload(false);
      await loadDashboard();
    } finally {
      setUploading(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<MeetingTask>) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await loadDashboard();
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const quotaBlocked = data.usage.remainingSeconds <= 0;
  const openTasks = data.tasks.filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => isTaskOverdue(task));
  const completedTasks = data.tasks.filter((task) => task.status === "completed");
  const completionRate = data.tasks.length === 0 ? 0 : Math.round((completedTasks.length / data.tasks.length) * 100);
  const latestTasks = [...data.tasks].sort(sortByExecutionPriority).slice(0, 8);
  const latestDecisions = data.decisions.slice(0, 6);
  const latestMeetings = data.meetings.slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* System status + Start meeting */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t("dashboard.title")}
          </h1>
          <div className="mt-2">
            <SystemStatus />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!recording && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(!showUpload)}
              >
                <Upload size={15} />
                {t("dashboard.uploadRecording")}
              </Button>
              <Button
                onClick={() => setRecording(true)}
                disabled={quotaBlocked}
                size="lg"
              >
                <Mic size={18} />
                {t("dashboard.startMeeting")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Recording session */}
      {recording && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
          <RecordingSession
            onFinished={() => {
              setRecording(false);
              void loadDashboard();
            }}
          />
        </div>
      )}

      {/* Upload panel */}
      {showUpload && !recording && (
        <form
          onSubmit={handleUpload}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {t("dashboard.uploadRecording")}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t("dashboard.uploadTitle")}
              </label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder={t("dashboard.uploadTitlePlaceholder")}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              />
            </div>
            <Button
              type="submit"
              disabled={!uploadFile || uploading || quotaBlocked}
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploading ? t("dashboard.processing") : t("dashboard.uploadSubmit")}
            </Button>
          </div>
        </form>
      )}

      {/* Quota warning */}
      {quotaBlocked && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("dashboard.quotaEmpty")}
        </div>
      )}

      {/* KPI cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("dashboard.openTasks")}
          value={String(openTasks.length)}
          icon={<ClipboardList size={18} />}
        />
        <KpiCard
          label={t("dashboard.overdueTasks")}
          value={String(overdueTasks.length)}
          icon={<CircleAlert size={18} />}
          tone={overdueTasks.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          label={t("dashboard.executionRate")}
          value={`${completionRate}%`}
          icon={<CheckCircle2 size={18} />}
          tone={completionRate >= 70 ? "success" : "default"}
        />
        <KpiCard
          label={t("dashboard.recentMeetings")}
          value={String(data.meetings.length)}
          icon={<CalendarDays size={18} />}
        />
      </section>

      {/* Tasks */}
      <section className="mb-8">
        <SectionPanel
          title={t("dashboard.tasks")}
          badge={`${openTasks.length} ${t("dashboard.openLabel")}`}
        >
          {latestTasks.length === 0 ? (
            <EmptyState label={t("dashboard.noTasks")} />
          ) : (
            <div className="space-y-3">
              {latestTasks.map((task) => (
                <TaskCard key={task.id} task={task} onSave={updateTask} />
              ))}
            </div>
          )}
        </SectionPanel>
      </section>

      {/* Decisions */}
      <section className="mb-8">
        <SectionPanel title={t("dashboard.decisions")}>
          {latestDecisions.length === 0 ? (
            <EmptyState label={t("dashboard.noDecisions")} />
          ) : (
            <div className="space-y-3">
              {latestDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-lg border border-slate-100 p-4"
                >
                  <div className="text-sm font-medium text-slate-900">
                    {decision.content}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-50 px-2.5 py-0.5">
                      {decision.meeting_title || t("common.untitledMeeting")}
                    </span>
                    {decision.meeting_created_at && (
                      <span className="rounded-full bg-slate-50 px-2.5 py-0.5">
                        {formatDate(decision.meeting_created_at, locale)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </section>

      {/* Meetings */}
      <section className="mb-8">
        <SectionPanel title={t("dashboard.meetings")}>
          {latestMeetings.length === 0 ? (
            <EmptyState label={t("dashboard.noMeetings")} />
          ) : (
            <div className="space-y-3">
              {latestMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {meeting.title || t("common.untitledMeeting")}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDate(meeting.created_at, locale)}
                      {" · "}
                      {t("dashboard.minutes", {
                        count: Math.ceil((meeting.duration ?? 0) / 60),
                      })}
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  const toneMap = {
    default: "border-slate-200 bg-white",
    danger: "border-red-100 bg-red-50/60",
    success: "border-emerald-100 bg-emerald-50/60",
  };
  const iconTone = {
    default: "bg-slate-100 text-slate-600",
    danger: "bg-red-100 text-red-600",
    success: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div className={`rounded-xl border p-5 ${toneMap[tone]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone[tone]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {badge && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function TaskCard({
  task,
  onSave,
}: {
  task: DashboardData["tasks"][number];
  onSave: (taskId: string, updates: Partial<MeetingTask>) => Promise<void>;
}) {
  const { t, locale } = useLanguage();
  const [owner, setOwner] = useState(task.owner_name ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);
  const visualStatus = getVisualTaskStatus(task, status, dueDate);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(task.id, {
        owner_name: owner || null,
        due_date: dueDate || null,
        status,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="text-sm font-medium text-slate-900">
            {task.description}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5">
              {task.meeting_title || t("common.untitledMeeting")}
            </span>
            <span className="rounded-full bg-slate-50 px-2.5 py-0.5">
              {owner || t("common.unassigned")}
            </span>
            {dueDate && (
              <span className="rounded-full bg-slate-50 px-2.5 py-0.5">
                {formatDate(dueDate, locale)}
              </span>
            )}
          </div>
        </div>
        <TaskStatusBadge status={visualStatus} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_160px_160px_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("meeting.owner")}
          </label>
          <Input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={t("common.unassigned")}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("meeting.dueDate")}
          </label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("meeting.status")}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <option value="in_progress">{t("common.inProgress")}</option>
            <option value="completed">{t("common.completed")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={save}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskStatusBadge({
  status,
}: {
  status: "new" | "in_progress" | "completed" | "overdue";
}) {
  const { t } = useLanguage();
  const styles = {
    new: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    overdue: "bg-red-50 text-red-700",
  } as const;

  const labels = {
    new: t("dashboard.statusNew"),
    in_progress: t("common.inProgress"),
    completed: t("common.completed"),
    overdue: t("dashboard.statusOverdue"),
  } as const;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/* ─── Helpers ─── */

function isTaskOverdue(task: Pick<MeetingTask, "due_date" | "status">) {
  if (task.status === "completed" || !task.due_date) return false;
  return new Date(task.due_date) < startOfToday();
}

function getVisualTaskStatus(
  task: Pick<MeetingTask, "created_at">,
  status: TaskStatus,
  dueDate: string
): "new" | "in_progress" | "completed" | "overdue" {
  if (status === "completed") return "completed";
  if (dueDate && new Date(dueDate) < startOfToday()) return "overdue";
  if (
    Date.now() - new Date(task.created_at).getTime() <=
    1000 * 60 * 60 * 24 * 2
  )
    return "new";
  return "in_progress";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sortByExecutionPriority(
  a: DashboardData["tasks"][number],
  b: DashboardData["tasks"][number]
) {
  const rank = (task: DashboardData["tasks"][number]) => {
    if (isTaskOverdue(task)) return 0;
    if (
      task.status !== "completed" &&
      Date.now() - new Date(task.created_at).getTime() <=
        1000 * 60 * 60 * 24 * 2
    )
      return 1;
    if (task.status !== "completed") return 2;
    return 3;
  };

  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function formatDate(date: string, locale: "en" | "ar") {
  return new Date(date).toLocaleDateString(
    locale === "ar" ? "ar-SA" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );
}
