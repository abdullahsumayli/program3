"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Edit2,
  RefreshCw,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/lib/i18n/context";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Meeting } from "@/lib/supabase/types";

export function MeetingDetail({ meeting: initial, trackId }: { meeting: Meeting; trackId: string }) {
  const { t, locale } = useLanguage();
  const [meeting, setMeeting] = useState(initial);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(meeting.summary ?? "");
  const [notesDraft, setNotesDraft] = useState(meeting.notes ?? "");
  const [regenerating, setRegenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const ArrowIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  const saveSummary = async () => {
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: summaryDraft }),
    });
    const updated = await res.json();
    setMeeting(updated);
    setEditingSummary(false);
  };

  const saveNotes = async () => {
    const res = await fetch(`/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    const updated = await res.json();
    setMeeting(updated);
  };

  const regenerateSummary = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, transcript: meeting.transcript }),
      });
      const data = await res.json();
      if (data.summary) {
        setMeeting({ ...meeting, summary: data.summary, title: data.title ?? meeting.title });
        setSummaryDraft(data.summary);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const exportAs = async (format: "pdf" | "docx" | "txt" | "md") => {
    const res = await fetch(`/api/export/${meeting.id}?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = format === "docx" ? "docx" : format;
    a.download = `${meeting.title || "meeting"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/track/${trackId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowIcon size={16} />
        {t("track.backToHome")}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {meeting.title || t("track.untitled")}
          </h1>
          <div className="mt-1 text-sm text-gray-500">
            {formatDate(meeting.created_at, locale)} · {formatDuration(meeting.duration)}
          </div>
        </div>
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(!exportOpen)}>
            <Download size={14} />
            {t("meeting.export")}
          </Button>
          {exportOpen && (
            <div className="absolute end-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
              <button
                className="block w-full px-4 py-2 text-start text-sm hover:bg-gray-50"
                onClick={() => exportAs("pdf")}
              >
                {t("meeting.exportPdf")}
              </button>
              <button
                className="block w-full px-4 py-2 text-start text-sm hover:bg-gray-50"
                onClick={() => exportAs("docx")}
              >
                {t("meeting.exportWord")}
              </button>
              <button
                className="block w-full px-4 py-2 text-start text-sm hover:bg-gray-50"
                onClick={() => exportAs("md")}
              >
                {t("meeting.exportMarkdown")}
              </button>
              <button
                className="block w-full px-4 py-2 text-start text-sm hover:bg-gray-50"
                onClick={() => exportAs("txt")}
              >
                {t("meeting.exportText")}
              </button>
            </div>
          )}
        </div>
      </div>

      {meeting.audio_url && (
        <div className="mb-6">
          <audio controls src={meeting.audio_url} className="w-full" />
        </div>
      )}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">{t("meeting.summary")}</TabsTrigger>
          <TabsTrigger value="transcript">{t("meeting.transcript")}</TabsTrigger>
          <TabsTrigger value="notes">{t("meeting.notes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateSummary}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {t("meeting.regenerate")}
              </Button>
              {!editingSummary ? (
                <Button variant="outline" size="sm" onClick={() => setEditingSummary(true)}>
                  <Edit2 size={14} />
                  {t("meeting.edit")}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditingSummary(false)}>
                    <X size={14} />
                    {t("meeting.cancel")}
                  </Button>
                  <Button size="sm" onClick={saveSummary}>
                    <Save size={14} />
                    {t("meeting.save")}
                  </Button>
                </>
              )}
            </div>
            {editingSummary ? (
              <Textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                rows={14}
              />
            ) : (
              <div className="whitespace-pre-wrap text-gray-800">
                {meeting.summary || (
                  <span className="text-gray-400">{t("meeting.noSummary")}</span>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transcript">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            {meeting.transcript_segments && meeting.transcript_segments.length > 0 ? (
              <div className="space-y-3">
                {meeting.transcript_segments.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 text-xs font-semibold text-blue-600">
                      {seg.speaker_name || t("recording.speaker", { id: seg.speaker_id })}:
                    </div>
                    <div className="text-gray-800">{seg.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-gray-800">{meeting.transcript}</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={saveNotes}
              placeholder={t("meeting.notesPlaceholder")}
              rows={10}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
