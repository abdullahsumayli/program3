ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'meetings'
    CHECK (type = 'meetings');
