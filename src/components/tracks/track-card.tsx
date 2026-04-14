"use client";

import Link from "next/link";
import { Trash2, Users, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/context";
import type { TrackWithCount } from "@/lib/supabase/types";

export function TrackCard({
  track,
  onDelete,
}: {
  track: TrackWithCount;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(t("common.confirmDelete"))) {
      onDelete(track.id);
    }
  };

  const isLecture = track.type === "lectures";
  const Icon = isLecture ? GraduationCap : Users;
  const iconColors = isLecture
    ? "bg-purple-100 text-purple-600"
    : "bg-blue-100 text-blue-600";
  const hoverBorder = isLecture ? "hover:border-purple-300" : "hover:border-blue-300";
  const countKey = isLecture ? "home.lectureCount" : "home.meetingCount";

  return (
    <Link href={`/track/${track.id}`} className="group">
      <Card className={`relative h-40 p-5 transition-all ${hoverBorder} hover:shadow-md`}>
        <button
          onClick={handleDelete}
          className="absolute top-3 end-3 rounded-md p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
          aria-label={t("common.delete")}
        >
          <Trash2 size={14} />
        </button>
        <div className="flex h-full flex-col justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconColors}`}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="truncate text-lg font-semibold text-gray-900">{track.name}</h3>
            <p className="mt-1 text-xs text-gray-500">
              {t(countKey, { count: track.meeting_count })}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
