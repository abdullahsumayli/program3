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
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-500">{t("common.loading")}</div>;
  }

  const quotaBlocked = data.usage.remainingSeconds <= 0;
  const openTasks = data.tasks.filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => isTaskOverdue(task));
  const completedTasks = data.tasks.filter((task) => task.status === "completed");
  const completionRate = data.tasks.length === 0 ? 0 : Math.round((completedTasks.length / data.tasks.length) * 100);
  const recentMeetingsCount = data.meetings.slice(0, 5).length;
  const latestTasks = [...data.tasks].sort(sortByExecutionPriority).slice(0, 8);
  const latestDecisions = data.decisions.slice(0, 6);
  const latestMeetings = data.meetings.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-8 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(248,250,252,0.18),_transparent_30%),linear-gradient(135deg,_#0f172a,_#111827_48%,_#1e293b)] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-200">
              {t("dashboard.executionLabel")}
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("dashboard.title")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">{t("dashboard.subtitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickSignal label={t("dashboard.openTasks")} value={String(openTasks.length)} hint={t("dashboard.tasksNeedFollowThrough")} tone="default" />
            <QuickSignal label={t("dashboard.overdueTasks")} value={String(overdueTasks.length)} hint={t("dashboard.needsAttention")} tone={overdueTasks.length > 0 ? "danger" : "default"} />
          </div>
        </div>
      </section>

      {quotaBlocked ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t("dashboard.quotaEmpty")}</div> : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ExecutionCard label={t("dashboard.openTasks")} value={String(openTasks.length)} hint={t("dashboard.openTasksHint")} icon={<ClipboardList size={18} />} />
        <ExecutionCard label={t("dashboard.overdueTasks")} value={String(overdueTasks.length)} hint={t("dashboard.overdueTasksHint")} icon={<CircleAlert size={18} />} tone={overdueTasks.length > 0 ? "danger" : "default"} />
        <ExecutionCard label={t("dashboard.decisionsExtracted")} value={String(data.decisions.length)} hint={t("dashboard.decisionsExtractedHint")} icon={<CheckCircle2 size={18} />} />
        <ExecutionCard label={t("dashboard.executionRate")} value={`${completionRate}%`} hint={t("dashboard.executionRateHint")} icon={<ArrowUpRight size={18} />} />
        <ExecutionCard label={t("dashboard.recentMeetings")} value={String(recentMeetingsCount)} hint={t("dashboard.recentMeetingsHint")} icon={<CalendarDays size={18} />} />
      </section>

      <section className="mb-8">
        <Panel
          title={t("dashboard.tasks")}
          description={t("dashboard.tasksPanelDescription")}
          action={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{t("dashboard.openTasksCount", { count: openTasks.length })}</span>}
        >
          {latestTasks.length === 0 ? <EmptyState label={t("dashboard.noTasks")} /> : <div className="space-y-3">{latestTasks.map((task) => <TaskCard key={task.id} task={task} onSave={updateTask} />)}</div>}
        </Panel>
      </section>

      <section className="mb-8">
        <Panel title={t("dashboard.decisions")} description={t("dashboard.decisionsPanelDescription")}>
          {latestDecisions.length === 0 ? (
            <EmptyState label={t("dashboard.noDecisions")} />
          ) : (
            <div className="space-y-3">
              {latestDecisions.map((decision) => (
                <div key={decision.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium leading-6 text-slate-900">{decision.content}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{decision.meeting_title || t("common.untitledMeeting")}</span>
                    {decision.meeting_created_at ? <span className="rounded-full bg-slate-100 px-3 py-1">{formatDate(decision.meeting_created_at, locale)}</span> : null}
                    <span className="rounded-full bg-slate-100 px-3 py-1">{decision.follow_up_owner ? t("dashboard.followUpOwnerNamed", { name: decision.follow_up_owner }) : t("dashboard.followUpOwnerMissing")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mb-8">
        <Panel title={t("dashboard.meetings")} description={t("dashboard.meetingsPanelDescription")}>
          {latestMeetings.length === 0 ? (
            <EmptyState label={t("dashboard.noMeetings")} />
          ) : (
            <div className="space-y-3">
              {latestMeetings.map((meeting) => (
                <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{meeting.title || t("common.untitledMeeting")}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDate(meeting.created_at, locale)}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{meeting.source_type === "uploaded_recording" ? t("dashboard.sourceUpload") : t("dashboard.sourceLive")}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span>{t("dashboard.minutes", { count: Math.ceil((meeting.duration ?? 0) / 60) })}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-900">{t("dashboard.viewMeeting")} <ArrowUpRight size={14} /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{t("dashboard.primaryCtaTitle")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("dashboard.primaryCtaDescription")}</p>
            </div>
            {!recording ? (
              <Button onClick={() => setRecording(true)} disabled={quotaBlocked} size="lg">
                <Mic size={18} />
                {t("dashboard.primaryCta")}
              </Button>
            ) : null}
          </div>

          {recording ? (
            <RecordingSession onFinished={() => { setRecording(false); void loadDashboard(); }} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
              <p className="text-sm leading-6 text-slate-600">{quotaBlocked ? t("dashboard.quotaEmpty") : t("dashboard.primaryCtaHelper")}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleUpload} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Upload size={18} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.uploadRecording")}</h2>
              <p className="text-sm text-slate-500">{t("dashboard.secondaryCtaDescription")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t("dashboard.uploadTitle")}</label>
              <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder={t("dashboard.uploadTitlePlaceholder")} />
            </div>
            <div>
              <input type="file" accept="audio/*,video/mp4,video/webm" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-700" />
            </div>
            <Button type="submit" variant="outline" disabled={!uploadFile || uploading || quotaBlocked} className="w-full justify-center">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? t("dashboard.processing") : t("dashboard.uploadSubmit")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function QuickSignal({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: "default" | "danger" }) {
  const classes = tone === "danger" ? "border-red-300/40 bg-red-500/10 text-red-50" : "border-white/15 bg-white/10 text-white";

  return (
    <div className={`rounded-2xl border px-4 py-4 backdrop-blur-sm ${classes}`}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-200">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-xs text-slate-200/90">{hint}</div>
    </div>
  );
}

function ExecutionCard({ label, value, hint, icon, tone = "default" }: { label: string; value: string; hint: string; icon: ReactNode; tone?: "default" | "danger" }) {
  const iconClass = tone === "danger" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-900";

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>{icon}</div>
      </div>
      <div className="mt-4 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action ?? null}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{label}</div>;
}

function TaskCard({ task, onSave }: { task: DashboardData["tasks"][number]; onSave: (taskId: string, updates: Partial<MeetingTask>) => Promise<void> }) {
  const { t, locale } = useLanguage();
  const [owner, setOwner] = useState(task.owner_name ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);
  const visualStatus = getVisualTaskStatus(task, status, dueDate);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(task.id, { owner_name: owner || null, due_date: dueDate || null, status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold leading-6 text-slate-900">{task.description}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">{task.meeting_title || t("common.untitledMeeting")}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{owner || t("common.unassigned")}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">{dueDate ? formatDate(dueDate, locale) : t("dashboard.noDueDate")}</span>
          </div>
        </div>
        <TaskStatusBadge status={visualStatus} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px_140px]">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t("meeting.owner")}</label>
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder={t("common.unassigned")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t("meeting.dueDate")}</label>
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t("meeting.status")}</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <option value="in_progress">{t("common.inProgress")}</option>
            <option value="completed">{t("common.completed")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={save} variant="outline" className="w-full justify-center" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: "new" | "in_progress" | "completed" | "overdue" }) {
  const { t } = useLanguage();
  const map = {
    new: "bg-sky-100 text-sky-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
  } as const;

  const labelMap = {
    new: t("dashboard.statusNew"),
    in_progress: t("common.inProgress"),
    completed: t("common.completed"),
    overdue: t("dashboard.statusOverdue"),
  } as const;

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${map[status]}`}>{labelMap[status]}</span>;
}

function isTaskOverdue(task: Pick<MeetingTask, "due_date" | "status">) {
  if (task.status === "completed" || !task.due_date) return false;
  return new Date(task.due_date) < startOfToday();
}

function getVisualTaskStatus(task: Pick<MeetingTask, "created_at">, status: TaskStatus, dueDate: string): "new" | "in_progress" | "completed" | "overdue" {
  if (status === "completed") return "completed";
  if (dueDate && new Date(dueDate) < startOfToday()) return "overdue";
  if (Date.now() - new Date(task.created_at).getTime() <= 1000 * 60 * 60 * 24 * 2) return "new";
  return "in_progress";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sortByExecutionPriority(a: DashboardData["tasks"][number], b: DashboardData["tasks"][number]) {
  const rank = (task: DashboardData["tasks"][number]) => {
    if (isTaskOverdue(task)) return 0;
    if (task.status !== "completed" && Date.now() - new Date(task.created_at).getTime() <= 1000 * 60 * 60 * 24 * 2) return 1;
    if (task.status !== "completed") return 2;
    return 3;
  };

  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function formatDate(date: string, locale: "en" | "ar") {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
