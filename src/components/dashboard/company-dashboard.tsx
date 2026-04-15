"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, Loader2, Upload } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="mb-8 rounded-3xl bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_35%),linear-gradient(135deg,_#0f172a,_#1e293b)] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
            <p className="mt-2 text-sm text-slate-200">{t("dashboard.subtitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <UsageCard label={t("dashboard.monthlyAllowance")} value={t("dashboard.minutes", { count: data.usage.limitMinutes })} />
            <UsageCard label={t("dashboard.usedMinutes")} value={t("dashboard.minutes", { count: data.usage.usedMinutes })} />
            <UsageCard label={t("dashboard.remainingMinutes")} value={t("dashboard.minutes", { count: data.usage.remainingMinutes })} />
          </div>
        </div>
      </section>

      {quotaBlocked && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t("dashboard.quotaEmpty")}</div>}

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.recordMeeting")}</h2>
            {!recording && <Button onClick={() => setRecording(true)} disabled={quotaBlocked}>{t("dashboard.recordMeeting")}</Button>}
          </div>
          {recording ? <RecordingSession onFinished={() => { setRecording(false); void loadDashboard(); }} /> : <p className="text-sm text-slate-600">{quotaBlocked ? t("dashboard.quotaEmpty") : t("recording.remoteDetail")}</p>}
        </div>

        <form onSubmit={handleUpload} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Upload size={18} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{t("dashboard.uploadRecording")}</h2>
              <p className="text-sm text-slate-500">{t("dashboard.uploadFileHint")}</p>
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
            <Button type="submit" disabled={!uploadFile || uploading || quotaBlocked} className="w-full justify-center">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? t("dashboard.processing") : t("dashboard.uploadSubmit")}
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <Panel title={t("dashboard.meetings")}>
          {data.meetings.length === 0 ? <EmptyState label={t("dashboard.noMeetings")} /> : (
            <div className="space-y-3">
              {data.meetings.map((meeting) => (
                <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{meeting.title || t("common.untitledMeeting")}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(meeting.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{meeting.source_type === "uploaded_recording" ? t("dashboard.sourceUpload") : t("dashboard.sourceLive")}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                    <span>{Math.ceil((meeting.duration ?? 0) / 60)} min</span>
                    <span className="inline-flex items-center gap-1 font-medium text-slate-900">{t("dashboard.viewMeeting")} <ArrowUpRight size={14} /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("dashboard.decisions")}>
          {data.decisions.length === 0 ? <EmptyState label={t("dashboard.noDecisions")} /> : (
            <div className="space-y-3">
              {data.decisions.map((decision) => (
                <div key={decision.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-medium text-slate-900">{decision.content}</div>
                  <div className="mt-2 text-xs text-slate-500">{decision.meeting_title || t("common.untitledMeeting")}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t("dashboard.tasks")}>
          {data.tasks.length === 0 ? <EmptyState label={t("dashboard.noTasks")} /> : <div className="space-y-3">{data.tasks.map((task) => <TaskCard key={task.id} task={task} onSave={updateTask} />)}</div>}
        </Panel>
      </section>
    </div>
  );
}

function UsageCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 px-4 py-3 backdrop-blur-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{label}</div>;
}

function TaskCard({ task, onSave }: { task: DashboardData["tasks"][number]; onSave: (taskId: string, updates: Partial<MeetingTask>) => Promise<void> }) {
  const { t } = useLanguage();
  const [owner, setOwner] = useState(task.owner_name ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);

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
      <div className="text-sm font-medium text-slate-900">{task.description}</div>
      <div className="mt-2 text-xs text-slate-500">{task.meeting_title || t("common.untitledMeeting")}</div>
      <div className="mt-4 space-y-3">
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
        <Button onClick={save} variant="outline" className="w-full justify-center" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
