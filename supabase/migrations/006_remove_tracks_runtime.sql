ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_track_id_fkey;
ALTER TABLE recording_sessions DROP CONSTRAINT IF EXISTS recording_sessions_track_id_fkey;

ALTER TABLE meetings DROP COLUMN IF EXISTS track_id;
ALTER TABLE recording_sessions DROP COLUMN IF EXISTS track_id;

DROP INDEX IF EXISTS idx_meetings_track_id;
DROP INDEX IF EXISTS idx_tracks_user_id;

DROP POLICY IF EXISTS "tracks_owner_all" ON tracks;
DROP TABLE IF EXISTS tracks CASCADE;
