-- Workspace-level meeting quota override for platform admins.
-- NULL = use the workspace plan limit, -1 = unlimited meetings, positive = custom monthly limit.

ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS monthly_meeting_limit_override INTEGER;

ALTER TABLE workspaces
    DROP CONSTRAINT IF EXISTS workspaces_monthly_meeting_limit_override_check;

ALTER TABLE workspaces
    ADD CONSTRAINT workspaces_monthly_meeting_limit_override_check
    CHECK (
        monthly_meeting_limit_override IS NULL
        OR monthly_meeting_limit_override = -1
        OR monthly_meeting_limit_override > 0
    );
