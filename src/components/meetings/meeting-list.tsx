"use client";

import { useCallback, useEffect, useState } from "react";
import { MeetingItem } from "./meeting-item";
import { useLanguage } from "@/lib/i18n/context";
import type { Meeting } from "@/lib/supabase/types";

export function MeetingList() {
  const { t } = useLanguage();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => setMeetings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const deleteMeeting = async (id: string) => {
    await fetch(`/api/meetings?id=${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="py-8 text-center text-slate-500">{t("common.loading")}</div>;
  if (meetings.length === 0) return <div className="py-8 text-center text-slate-500">{t("dashboard.noMeetings")}</div>;

  return <div className="space-y-2">{meetings.map((m) => <MeetingItem key={m.id} meeting={m} onDelete={deleteMeeting} />)}</div>;
}
