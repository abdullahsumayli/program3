"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/context";
import type { Meeting, MeetingDecision, MeetingTask, TaskStatus } from "@/lib/supabase/types";

export function MeetingDetail({ meeting: initialMeeting, decisions: initialDecisions, tasks: initialTasks }: { meeting: Meeting; decisions: MeetingDecision[]; tasks: MeetingTask[] }) {
  const { t, locale } = useLanguage();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [decisions, setDecisions] = useState(initialDecisions);
  const [tasks, setTasks] = useState(initialTasks);
  const [regenerating, setRegenerating] = useState(false);

  const reload = async () => {
    const [meetingResponse, dashboardResponse] = await Promise.all([
      fetch(`/api/meetings/${meeting.id}`),
      fetch(`/api/dashboard`),
    ]);

    const meetingData = await meetingResponse.json();
    const dashboardData = await dashboardResponse.json();

    setMeeting(meetingData);
    setDecisions(dashboardData.decisions.filter((decision: MeetingDecision & { meeting_title: string | null }) => decision.meeting_id === meeting.id));
    setTasks(dashboardData.tasks.filter((task: MeetingTask & { meeting_title: string | null }) => task.meeting_id === meeting.id));
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, transcript: meeting.transcript, fallbackTitle: meeting.title }),
      });
      if (!response.ok) throw new Error("Failed to regenerate");
      await reload();
    } finally {
      setRegenerating(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<MeetingTask>) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await reload();
  };

  return (
    <>
    <div className="mx-auto max-w-6xl px-4 py-8 print-hidden">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">{t("meeting.back")}</Link>
      <div className="mt-4 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">{meeting.title || t("common.untitledMeeting")}</h1>
                <div className="mt-2 text-sm text-slate-500">{new Date(meeting.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} · {Math.ceil((meeting.duration ?? 0) / 60)} min</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <FileDown size={16} />
                  {t("meeting.exportPdf")}
                </Button>
                <Button variant="outline" onClick={regenerate} disabled={regenerating}>
                  {regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {t("meeting.regenerate")}
                </Button>
              </div>
            </div>
            {meeting.audio_url && <audio controls src={meeting.audio_url} className="mt-4 w-full" />}
          </div>

          <SectionCard title={t("meeting.summary")}>
            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{meeting.summary || t("meeting.noSummary")}</div>
          </SectionCard>

          <SectionCard title={t("meeting.transcript")}>
            <div className="space-y-3 text-sm leading-7 text-slate-700">
              {meeting.transcript_segments?.length
                ? meeting.transcript_segments.map((segment, index) => (
                    <div key={index} className="rounded-2xl bg-slate-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-slate-500">{segment.speaker_name || t("recording.speaker", { id: segment.speaker_id })}</div>
                      <div>{segment.text}</div>
                    </div>
                  ))
                : meeting.transcript}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title={t("meeting.keyPoints")}>
            <ul className="space-y-2 text-sm text-slate-700">{(meeting.key_points ?? []).map((point, index) => <li key={index} className="rounded-2xl bg-slate-50 p-3">{point}</li>)}</ul>
          </SectionCard>

          <SectionCard title={t("meeting.decisions")}>
            <ul className="space-y-2 text-sm text-slate-700">{decisions.map((decision) => <li key={decision.id} className="rounded-2xl bg-slate-50 p-3">{decision.content}</li>)}</ul>
          </SectionCard>

          <SectionCard title={t("meeting.tasks")}>
            <div className="space-y-4">{tasks.map((task) => <MeetingTaskEditor key={task.id} task={task} onSave={updateTask} />)}</div>
          </SectionCard>
        </div>
      </div>
    </div>
    <MeetingPrintView meeting={meeting} decisions={decisions} tasks={tasks} />
    </>
  );
}

function MeetingPrintView({ meeting, decisions, tasks }: { meeting: Meeting; decisions: MeetingDecision[]; tasks: MeetingTask[] }) {
  const { t, locale } = useLanguage();
  const dateStr = new Date(meeting.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
  const statusLabel = (status: TaskStatus) => (status === "completed" ? t("common.completed") : t("common.inProgress"));
  const fmtDate = (value: string) =>
    new Date(value).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const keyPoints = meeting.key_points ?? [];

  return (
    <div className="hidden print-only px-2 leading-7 text-slate-900" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="mb-6 border-b border-slate-300 pb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting OS</div>
        <h1 className="mt-1 text-2xl font-semibold">{meeting.title || t("common.untitledMeeting")}</h1>
        <div className="mt-1 text-sm text-slate-500">
          {dateStr} · {Math.ceil((meeting.duration ?? 0) / 60)} min
        </div>
      </header>

      <PrintSection title={t("meeting.summary")}>
        <p className="whitespace-pre-wrap text-sm">{meeting.summary || t("meeting.noSummary")}</p>
      </PrintSection>

      <PrintSection title={t("meeting.keyPoints")}>
        {keyPoints.length ? (
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("meeting.noKeyPoints")}</p>
        )}
      </PrintSection>

      <PrintSection title={t("meeting.decisions")}>
        {decisions.length ? (
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {decisions.map((decision) => (
              <li key={decision.id}>{decision.content}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("meeting.noDecisions")}</p>
        )}
      </PrintSection>

      <PrintSection title={t("meeting.tasks")}>
        {tasks.length ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs text-slate-500">
                <th className="py-1.5 pe-3 text-start font-medium">{t("meeting.description")}</th>
                <th className="py-1.5 pe-3 text-start font-medium">{t("meeting.owner")}</th>
                <th className="py-1.5 pe-3 text-start font-medium">{t("meeting.dueDate")}</th>
                <th className="py-1.5 text-start font-medium">{t("meeting.status")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="break-inside-avoid border-b border-slate-100 align-top">
                  <td className="py-1.5 pe-3">{task.description}</td>
                  <td className="py-1.5 pe-3 text-slate-600">{task.owner_name || t("common.unassigned")}</td>
                  <td className="whitespace-nowrap py-1.5 pe-3 text-slate-600">
                    {task.due_date ? fmtDate(task.due_date) : "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-slate-600">{statusLabel(task.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">{t("meeting.noTasks")}</p>
        )}
      </PrintSection>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function MeetingTaskEditor({ task, onSave }: { task: MeetingTask; onSave: (taskId: string, updates: Partial<MeetingTask>) => Promise<void> }) {
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
      <div className="mt-3 space-y-3">
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
        <Button variant="outline" onClick={save} className="w-full justify-center" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
