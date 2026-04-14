export type TrackType = "meetings" | "lectures";

export type Track = {
  id: string;
  name: string;
  type: TrackType;
  created_at: string;
};

export type TrackWithCount = Track & {
  meeting_count: number;
};

export type TranscriptSegment = {
  speaker_id: number;
  speaker_name?: string;
  text: string;
  start_ms: number;
  end_ms: number;
  is_final?: boolean;
};

export type Meeting = {
  id: string;
  track_id: string;
  title: string | null;
  transcript: string;
  transcript_segments: TranscriptSegment[] | null;
  summary: string | null;
  notes: string | null;
  duration: number;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type MeetingTag = {
  meeting_id: string;
  tag_id: string;
};

export type Settings = {
  id: number;
  system_prompt: string;
  language: "en" | "ar";
  updated_at: string;
};
