"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingList } from "@/components/meetings/meeting-list";
import { RecordingSession } from "@/components/recording/recording-session";
import { useLanguage } from "@/lib/i18n/context";
import type { Track } from "@/lib/supabase/types";

export function TrackView({ track }: { track: Track }) {
  const { t, locale } = useLanguage();
  const [recording, setRecording] = useState(false);
  const ArrowIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const isLecture = track.type === "lectures";
  const startKey = isLecture ? "track.startLecture" : "track.startMeeting";
  const previousKey = isLecture ? "track.previousLectures" : "track.previousMeetings";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowIcon size={16} />
        {t("track.backToHome")}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">{track.name}</h1>
        {!recording && (
          <Button size="lg" onClick={() => setRecording(true)}>
            <Mic size={18} />
            {t(startKey)}
          </Button>
        )}
      </div>

      {recording && (
        <div className="mb-6">
          <RecordingSession
            trackId={track.id}
            trackType={track.type}
            onFinished={() => setRecording(false)}
          />
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t(previousKey)}</h2>
        <MeetingList trackId={track.id} trackType={track.type} />
      </div>
    </div>
  );
}
