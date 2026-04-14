"use client";

import Link from "next/link";
import { Trash2, Clock, FileText } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Meeting } from "@/lib/supabase/types";

export function MeetingItem({
  meeting,
  trackId,
  onDelete,
}: {
  meeting: Meeting;
  trackId: string;
  onDelete: (id: string) => void;
}) {
  const { t, locale } = useLanguage();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(t("common.confirmDelete"))) {
      onDelete(meeting.id);
    }
  };

  return (
    <Link href={`/track/${trackId}/meeting/${meeting.id}`}>
      <div className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-sm">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-gray-900">
            {meeting.title || t("track.untitled")}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{formatDate(meeting.created_at, locale)}</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(meeting.duration)}
            </span>
          </div>
          {meeting.summary && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{meeting.summary}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-md p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
          aria-label={t("common.delete")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Link>
  );
}
