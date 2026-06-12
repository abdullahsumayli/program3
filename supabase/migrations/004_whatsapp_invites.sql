-- WhatsApp link-based invites.
--
-- Invites are now shared via a WhatsApp link instead of (or in addition to)
-- email. Anyone who opens the link and signs in joins the workspace, so the
-- invite token itself is the capability and we no longer require the accepting
-- user's email to match the invite. Email becomes optional and we keep an
-- optional phone number for record-keeping / re-sending the WhatsApp message.

ALTER TABLE workspace_invites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE workspace_invites ADD COLUMN IF NOT EXISTS phone TEXT;

-- Replace the accept function: drop the email-match requirement. Possession of
-- a valid, unexpired, unaccepted token is enough to join.
CREATE OR REPLACE FUNCTION public.accept_workspace_invite(invite_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    invite RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO invite FROM public.workspace_invites WHERE token = invite_token;
    IF invite.id IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;
    IF invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Already accepted'; END IF;
    IF invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (invite.workspace_id, auth.uid(), invite.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.workspace_invites SET accepted_at = now() WHERE id = invite.id;

    RETURN invite.workspace_id;
END;
$$;
