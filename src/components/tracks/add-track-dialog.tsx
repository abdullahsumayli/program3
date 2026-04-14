"use client";

import { useState } from "react";
import { Users, GraduationCap } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/context";
import type { TrackType } from "@/lib/supabase/types";

export function AddTrackDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [type, setType] = useState<TrackType>("meetings");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setType("meetings");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type }),
      });
      reset();
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title={t("home.addTrackTitle")}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t("home.trackType")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <TypeOption
              active={type === "meetings"}
              onClick={() => setType("meetings")}
              icon={<Users size={20} />}
              label={t("home.typeMeetings")}
              hint={t("home.typeMeetingsHint")}
            />
            <TypeOption
              active={type === "lectures"}
              onClick={() => setType("lectures")}
              icon={<GraduationCap size={20} />}
              label={t("home.typeLectures")}
              hint={t("home.typeLecturesHint")}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t("home.trackName")}
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              type === "lectures"
                ? t("home.addTrackPlaceholderLectures")
                : t("home.addTrackPlaceholder")
            }
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {t("common.confirm")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TypeOption({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors ${
        active
          ? "border-blue-500 bg-blue-50 text-blue-900"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          active ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
        }`}
      >
        {icon}
      </div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      <div className="text-xs text-gray-500">{hint}</div>
    </button>
  );
}
