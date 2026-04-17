-- Billing tiers: Basic / Pro / Enterprise
-- Adds new plan tiers and subscription states (trial, expired).

-- Drop and recreate plan constraint to support new tiers
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check
    CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));

-- Drop and recreate subscription_status constraint with trial + expired
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_subscription_status_check;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_subscription_status_check
    CHECK (subscription_status IN ('active', 'trial', 'expired', 'canceled', 'past_due'));

-- Track subscription period explicitly
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

-- Migrate existing 'paid' workspaces to 'basic'
UPDATE workspaces SET plan = 'basic' WHERE plan = 'paid';
