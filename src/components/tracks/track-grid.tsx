"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { TrackCard } from "./track-card";
import { AddTrackDialog } from "./add-track-dialog";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { useLanguage } from "@/lib/i18n/context";
import type { TrackWithCount } from "@/lib/supabase/types";

type SearchResult = {
  id: string;
  track_id: string;
  title: string | null;
  summary: string | null;
  track_name: string;
};

export function TrackGrid() {
  const { t } = useLanguage();
  const [tracks, setTracks] = useState<TrackWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const loadTracks = () => {
    setLoading(true);
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((data) => setTracks(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTracks();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const deleteTrack = async (id: string) => {
    await fetch(`/api/tracks?id=${id}`, { method: "DELETE" });
    loadTracks();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("home.title")}</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          {t("home.addTrack")}
        </Button>
      </div>

      <div className="mb-6 max-w-md">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("home.searchPlaceholder")}
        />
      </div>

      {search.trim() && results.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </h2>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id}>
                <a
                  href={`/track/${r.track_id}/meeting/${r.id}`}
                  className="block rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="text-xs text-gray-500">{r.track_name}</div>
                  <div className="font-medium text-gray-900">
                    {r.title || t("track.untitled")}
                  </div>
                  {r.summary && (
                    <div className="mt-1 line-clamp-2 text-sm text-gray-600">{r.summary}</div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">{t("common.loading")}</div>
      ) : tracks.length === 0 ? (
        <div className="py-12 text-center text-gray-500">{t("home.noTracks")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tracks.map((track) => (
            <TrackCard key={track.id} track={track} onDelete={deleteTrack} />
          ))}
        </div>
      )}

      <AddTrackDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={loadTracks} />
    </div>
  );
}
