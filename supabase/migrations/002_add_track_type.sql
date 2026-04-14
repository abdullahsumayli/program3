-- Add track type to distinguish between meeting tracks and lecture tracks
ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'meetings'
    CHECK (type IN ('meetings', 'lectures'));
