"use client";

import { useEffect, useState } from "react";
import { MeetingItem } from "./meeting-item";
import { useLanguage } from "@/lib/i18n/context";
import type { Meeting, TrackType } from "@/lib/supabase/types";

export function MeetingList({
  trackId,
  trackType = "meetings",
}: {
  trackId: string;
  trackType?: TrackType;
}) {
  const { t } = useLanguage();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/meetings?track_id=${trackId}`)
      .then((r) => r.json())
      .then((data) => setMeetings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [trackId]);

  const deleteMeeting = async (id: string) => {
    await fetch(`/api/meetings?id=${id}`, { method: "DELETE" });
    load();
  };

  const isLecture = trackType === "lectures";

  if (loading) {
    return <div className="py-8 text-center text-gray-500">{t("common.loading")}</div>;
  }

  if (meetings.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        {t(isLecture ? "track.noLectures" : "track.noMeetings")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((m) => (
        <MeetingItem key={m.id} meeting={m} trackId={trackId} onDelete={deleteMeeting} />
      ))}
    </div>
  );
}
