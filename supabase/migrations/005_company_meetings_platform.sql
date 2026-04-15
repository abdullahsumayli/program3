UPDATE tracks
SET type = 'meetings'
WHERE type <> 'meetings';

ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_type_check;
ALTER TABLE tracks
    ADD CONSTRAINT tracks_type_check CHECK (type = 'meetings');

ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS key_points JSONB,
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'live_recording'
        CHECK (source_type IN ('live_recording', 'uploaded_recording')),
    ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'completed'
        CHECK (processing_status IN ('processing', 'completed', 'error')),
    ADD COLUMN IF NOT EXISTS processing_error TEXT;

CREATE TABLE IF NOT EXISTS meeting_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    owner_name TEXT,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting_id ON meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_user_id ON meeting_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting_id ON meeting_tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_user_id ON meeting_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_status ON meeting_tasks(status);

ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_decisions_owner_all" ON meeting_decisions;
CREATE POLICY "meeting_decisions_owner_all" ON meeting_decisions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meeting_tasks_owner_all" ON meeting_tasks;
CREATE POLICY "meeting_tasks_owner_all" ON meeting_tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
