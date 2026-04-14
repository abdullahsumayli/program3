-- Meeting Transcription App - Initial Schema

-- tracks: المسارات/الأشخاص
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- meetings: الاجتماعات
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    title TEXT,
    transcript TEXT NOT NULL DEFAULT '',
    transcript_segments JSONB,
    summary TEXT,
    notes TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_track_id ON meetings(track_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);

-- Full-text search column (simple dictionary works for both Arabic and English)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(title, '') || ' ' ||
            coalesce(transcript, '') || ' ' ||
            coalesce(summary, '') || ' ' ||
            coalesce(notes, '')
        )
    ) STORED;
CREATE INDEX IF NOT EXISTS idx_meetings_fts ON meetings USING gin(fts);

-- tags: تصنيفات الاجتماعات
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- meeting_tags: many-to-many
CREATE TABLE IF NOT EXISTS meeting_tags (
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (meeting_id, tag_id)
);

-- settings: singleton row
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_prompt TEXT NOT NULL DEFAULT 'You are a professional meeting summarization assistant. Given a meeting transcript, produce a clear structured summary including: (1) Key discussion points, (2) Decisions made, (3) Action items with owners if mentioned, (4) Follow-ups needed. Use the same language as the transcript (Arabic or English). Be concise but comprehensive.',
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Storage bucket for audio files (create via Supabase dashboard or separate SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-audio', 'meeting-audio', true);
