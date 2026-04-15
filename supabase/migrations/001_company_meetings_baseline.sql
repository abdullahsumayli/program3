-- Company meetings platform baseline schema

CREATE TABLE IF NOT EXISTS settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    transcript TEXT NOT NULL DEFAULT '',
    transcript_segments JSONB,
    summary TEXT,
    key_points JSONB,
    notes TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'live_recording'
        CHECK (source_type IN ('live_recording', 'uploaded_recording')),
    processing_status TEXT NOT NULL DEFAULT 'completed'
        CHECK (processing_status IN ('processing', 'completed', 'error')),
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_processing_status ON meetings(processing_status);

CREATE TABLE IF NOT EXISTS meeting_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting_id ON meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_user_id ON meeting_decisions(user_id);

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

CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting_id ON meeting_tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_user_id ON meeting_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_status ON meeting_tasks(status);

CREATE TABLE IF NOT EXISTS recording_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
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

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_owner_all" ON settings;
CREATE POLICY "settings_owner_all" ON settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meetings_owner_all" ON meetings;
CREATE POLICY "meetings_owner_all" ON meetings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meeting_decisions_owner_all" ON meeting_decisions;
CREATE POLICY "meeting_decisions_owner_all" ON meeting_decisions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meeting_tasks_owner_all" ON meeting_tasks;
CREATE POLICY "meeting_tasks_owner_all" ON meeting_tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recording_sessions_owner_all" ON recording_sessions;
CREATE POLICY "recording_sessions_owner_all" ON recording_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-audio', 'meeting-audio', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "meeting_audio_owner_select" ON storage.objects;
CREATE POLICY "meeting_audio_owner_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'meeting-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "meeting_audio_owner_insert" ON storage.objects;
CREATE POLICY "meeting_audio_owner_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'meeting-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "meeting_audio_owner_delete" ON storage.objects;
CREATE POLICY "meeting_audio_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'meeting-audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
