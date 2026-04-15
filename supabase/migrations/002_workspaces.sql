-- Multi-tenant workspaces, roles, invites, and billing

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
    subscription_status TEXT NOT NULL DEFAULT 'active'
        CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
    subscription_renews_at TIMESTAMPTZ,
    moyasar_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

DO $$ BEGIN
    CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role workspace_role NOT NULL DEFAULT 'member',
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

-- Helper used by every RLS policy on tenant data. Defined as SECURITY DEFINER
-- so the check itself does not trigger RLS on workspace_members (which would
-- recurse).
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(ws UUID)
RETURNS workspace_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role FROM workspace_members
    WHERE workspace_id = ws AND user_id = auth.uid()
    LIMIT 1;
$$;

-- Add workspace_id to existing tenant tables. We keep user_id around as
-- "creator/actor" for audit; scoping now happens on workspace_id.
ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE meeting_decisions
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE meeting_tasks
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE recording_sessions
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS default_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Backfill: give every existing user their own workspace and mark them owner.
INSERT INTO workspaces (name, owner_id)
SELECT COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Workspace') || '''s Workspace', u.id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.owner_id = u.id
);

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM workspaces w
ON CONFLICT DO NOTHING;

UPDATE settings s
SET default_workspace_id = (
    SELECT id FROM workspaces WHERE owner_id = s.user_id ORDER BY created_at LIMIT 1
)
WHERE default_workspace_id IS NULL;

UPDATE meetings m
SET workspace_id = (SELECT id FROM workspaces WHERE owner_id = m.user_id ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;

UPDATE meeting_decisions d
SET workspace_id = (SELECT id FROM workspaces WHERE owner_id = d.user_id ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;

UPDATE meeting_tasks t
SET workspace_id = (SELECT id FROM workspaces WHERE owner_id = t.user_id ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;

UPDATE recording_sessions r
SET workspace_id = (SELECT id FROM workspaces WHERE owner_id = r.user_id ORDER BY created_at LIMIT 1)
WHERE workspace_id IS NULL;

ALTER TABLE meetings ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE meeting_decisions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE meeting_tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE recording_sessions ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_workspace_id ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_workspace_id ON meeting_decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_workspace_id ON meeting_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_workspace_id ON recording_sessions(workspace_id);

-- Auto-provision a workspace whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_workspace_id UUID;
    display_name TEXT;
BEGIN
    display_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        split_part(NEW.email, '@', 1),
        'Workspace'
    );

    INSERT INTO public.workspaces (name, owner_id)
    VALUES (display_name || '''s Workspace', NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'owner');

    INSERT INTO public.settings (user_id, default_workspace_id)
    VALUES (NEW.id, new_workspace_id)
    ON CONFLICT (user_id) DO UPDATE SET default_workspace_id = EXCLUDED.default_workspace_id;

    RETURN NEW;
END;
$$;

-- Drop legacy owner-only policies; replace with workspace membership policies.
DROP POLICY IF EXISTS "settings_owner_all" ON settings;
DROP POLICY IF EXISTS "meetings_owner_all" ON meetings;
DROP POLICY IF EXISTS "meeting_decisions_owner_all" ON meeting_decisions;
DROP POLICY IF EXISTS "meeting_tasks_owner_all" ON meeting_tasks;
DROP POLICY IF EXISTS "recording_sessions_owner_all" ON recording_sessions;

-- Settings stays per-user (user preferences, not workspace-scoped).
CREATE POLICY "settings_owner_all" ON settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meetings_workspace_access" ON meetings
    FOR ALL USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "meeting_decisions_workspace_access" ON meeting_decisions
    FOR ALL USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "meeting_tasks_workspace_access" ON meeting_tasks
    FOR ALL USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "recording_sessions_workspace_access" ON recording_sessions
    FOR ALL USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Workspace tables RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_member_select" ON workspaces;
CREATE POLICY "workspaces_member_select" ON workspaces
    FOR SELECT USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "workspaces_owner_update" ON workspaces;
CREATE POLICY "workspaces_owner_update" ON workspaces
    FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_owner_delete" ON workspaces;
CREATE POLICY "workspaces_owner_delete" ON workspaces
    FOR DELETE USING (owner_id = auth.uid());

-- Any authenticated user may create a workspace (they become owner via API).
DROP POLICY IF EXISTS "workspaces_self_insert" ON workspaces;
CREATE POLICY "workspaces_self_insert" ON workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_self_read" ON workspace_members;
CREATE POLICY "workspace_members_self_read" ON workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_workspace_member(workspace_id)
    );

-- Admins/owners can add/remove members. Enforced by API; policy restricts the
-- write to users whose role in the workspace is owner or admin.
DROP POLICY IF EXISTS "workspace_members_admin_write" ON workspace_members;
CREATE POLICY "workspace_members_admin_write" ON workspace_members
    FOR ALL USING (
        public.workspace_role_of(workspace_id) IN ('owner', 'admin')
    ) WITH CHECK (
        public.workspace_role_of(workspace_id) IN ('owner', 'admin')
    );

DROP POLICY IF EXISTS "workspace_invites_member_read" ON workspace_invites;
CREATE POLICY "workspace_invites_member_read" ON workspace_invites
    FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "workspace_invites_admin_write" ON workspace_invites;
CREATE POLICY "workspace_invites_admin_write" ON workspace_invites
    FOR ALL USING (
        public.workspace_role_of(workspace_id) IN ('owner', 'admin')
    ) WITH CHECK (
        public.workspace_role_of(workspace_id) IN ('owner', 'admin')
    );

-- Accepting an invite must run with SECURITY DEFINER because the user is not
-- yet a member of the workspace when they call it, so RLS would otherwise
-- block reading the invite row.
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite RECORD;
    current_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT email INTO current_email FROM auth.users WHERE id = auth.uid();

    SELECT * INTO invite FROM public.workspace_invites WHERE token = invite_token;
    IF invite.id IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;
    IF invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Already accepted'; END IF;
    IF invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
    IF lower(invite.email) <> lower(current_email) THEN
        RAISE EXCEPTION 'Invite email mismatch';
    END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (invite.workspace_id, auth.uid(), invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.workspace_invites SET accepted_at = now() WHERE id = invite.id;

    RETURN invite.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_workspace_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(TEXT) TO authenticated;

-- Storage bucket: switch to workspace-prefixed paths so teammates can access
-- the same workspace's recordings.
DROP POLICY IF EXISTS "meeting_audio_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "meeting_audio_owner_delete" ON storage.objects;

CREATE POLICY "meeting_audio_workspace_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'meeting-audio'
        AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    );

CREATE POLICY "meeting_audio_workspace_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'meeting-audio'
        AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    );

CREATE POLICY "meeting_audio_workspace_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'meeting-audio'
        AND public.is_workspace_member(((storage.foldername(name))[1])::uuid)
    );
