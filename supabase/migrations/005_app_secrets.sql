-- Runtime-managed API keys configured from the admin console.
-- Values are read only by server-side service-role code.

CREATE TABLE IF NOT EXISTS app_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- No client policies by design. The service role bypasses RLS, and admin API
-- routes enforce ADMIN_EMAILS before reading or writing these secrets.
