CREATE TABLE IF NOT EXISTS recording_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
    meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    recording_mode TEXT NOT NULL CHECK (recording_mode IN ('remote-share', 'mic-only')),
    status TEXT NOT NULL DEFAULT 'starting'
        CHECK (status IN ('starting', 'recording', 'completed', 'interrupted', 'error')),
    interruption_count INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    system_audio_requested BOOLEAN NOT NULL DEFAULT false,
    system_audio_active BOOLEAN NOT NULL DEFAULT false,
    last_error_status TEXT,
    last_error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_id
    ON recording_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_recording_sessions_status_started_at
    ON recording_sessions(status, started_at DESC);

ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recording_sessions_owner_all" ON recording_sessions;
CREATE POLICY "recording_sessions_owner_all" ON recording_sessions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
