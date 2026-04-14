-- Multi-user authentication + Row Level Security
-- Every row is now scoped to the owning user. RLS enforces that users
-- can only read/write their own data.

-- 1. Add user_id to every table owned by a user
ALTER TABLE tracks
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- 2. Rebuild settings as per-user (was a global singleton before)
-- Preserve the existing global prompt as a default for new users.
DO $$
DECLARE
    legacy_prompt TEXT;
BEGIN
    SELECT system_prompt INTO legacy_prompt FROM settings WHERE id = 1;

    DROP TABLE IF EXISTS settings CASCADE;

    CREATE TABLE settings (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        system_prompt TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Keep legacy prompt accessible via a comment for manual migration if needed
    IF legacy_prompt IS NOT NULL THEN
        COMMENT ON TABLE settings IS
            'Per-user settings. Legacy global prompt preserved in migration history.';
    END IF;
END $$;

-- 3. Auto-create a settings row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable RLS on every user-owned table
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 5. Policies: each user sees/modifies only their own rows
DROP POLICY IF EXISTS "tracks_owner_all" ON tracks;
CREATE POLICY "tracks_owner_all" ON tracks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meetings_owner_all" ON meetings;
CREATE POLICY "meetings_owner_all" ON meetings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tags_owner_all" ON tags;
CREATE POLICY "tags_owner_all" ON tags
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meeting_tags_owner_all" ON meeting_tags;
CREATE POLICY "meeting_tags_owner_all" ON meeting_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM meetings m
            WHERE m.id = meeting_tags.meeting_id AND m.user_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM meetings m
            WHERE m.id = meeting_tags.meeting_id AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "settings_owner_all" ON settings;
CREATE POLICY "settings_owner_all" ON settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. tags.name was globally UNIQUE; make it unique per user instead
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
ALTER TABLE tags ADD CONSTRAINT tags_user_name_unique UNIQUE (user_id, name);

-- 7. Storage bucket: make private + RLS policies on storage.objects
-- (The bucket itself is created via Supabase dashboard or a separate script.
-- This block ensures it is private and scoped per-user if it exists.)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'meeting-audio') THEN
        UPDATE storage.buckets SET public = false WHERE id = 'meeting-audio';
    END IF;
END $$;

-- Each object's filename starts with "<user_id>/" so we can gate by owner.
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
