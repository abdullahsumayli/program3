-- Billing: usage tracking + subscription audit log

CREATE TABLE IF NOT EXISTS usage_counters (
    workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    seconds_used INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    moyasar_payment_id TEXT,
    moyasar_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_workspace_id
    ON subscription_events(workspace_id);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_counters_member_select" ON usage_counters;
CREATE POLICY "usage_counters_member_select" ON usage_counters
    FOR SELECT USING (public.is_workspace_member(workspace_id));

-- No client writes; only the service role (via server routes) updates counters.

DROP POLICY IF EXISTS "subscription_events_member_select" ON subscription_events;
CREATE POLICY "subscription_events_member_select" ON subscription_events
    FOR SELECT USING (
        workspace_id IS NOT NULL
        AND public.workspace_role_of(workspace_id) IN ('owner', 'admin')
    );
