# Engineering Handoff

Last updated: 2026-04-15

This file is the handoff note for the next developer who opens this repo.

## What The Product Is

This project is now a company meetings execution platform.

It is not a student, lecture, or study product anymore.

The intended story is:
- meetings go in
- transcript, summary, decisions, and tasks come out
- teams follow execution from the dashboard

## What Has Already Been Done

### Product repositioning

- Removed legacy student/lecture/study positioning.
- Reframed the product around execution after meetings.
- Reordered the homepage to emphasize:
  - execution metrics
  - tasks
  - decisions
  - meetings
  - recording and upload as tools, not as the main story

### Core meeting system

- Live meeting recording exists.
- Uploading a ready-made recording exists.
- Meetings are processed into:
  - transcript
  - summary
  - key points
  - decisions
  - tasks

### Dashboard

- Dashboard is focused on operational outputs.
- Main metrics are execution-oriented.
- Tasks and decisions are displayed ahead of recording controls.

### Settings and diagnostics

- Settings panel includes a connection health check.
- Health check covers:
  - Supabase
  - Soniox
  - OpenRouter

### Recording reliability work

- Added a safer start flow for recording.
- Added cancel support while recording is starting.
- Added a fail-fast timeout for Soniox session startup.
- Improved microphone test feedback.
- Fixed broken Arabic labels for microphone status messages.

## Current Architecture Snapshot

### Main frontend areas

- `src/components/dashboard/company-dashboard.tsx`
- `src/components/recording/recording-session.tsx`
- `src/components/recording/mic-test.tsx`
- `src/components/meetings/meeting-detail.tsx`
- `src/components/layout/header.tsx`

### Main APIs

- `src/app/api/dashboard/route.ts`
- `src/app/api/meetings/route.ts`
- `src/app/api/meetings/[id]/route.ts`
- `src/app/api/meetings/upload/route.ts`
- `src/app/api/recording-sessions/route.ts`
- `src/app/api/recording-sessions/[id]/route.ts`
- `src/app/api/soniox-temp-key/route.ts`
- `src/app/api/summarize/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/upload-audio/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/settings/route.ts`

### Main server-side helpers

- `src/lib/meeting-processing.ts`
- `src/lib/meetings.ts`
- `src/lib/supabase/auth.ts`
- `src/lib/supabase/types.ts`

## Database Status

Current migration files in the working tree:

- `supabase/migrations/001_company_meetings_baseline.sql`
- `supabase/migrations/002_workspaces.sql`
- `supabase/migrations/003_billing.sql`

This means the codebase has already moved beyond the earlier one-user baseline and has a local in-progress SaaS layer.

## Important Reality About The Repo State

There are two truths at the same time:

### 1. The core meetings product is already in a usable state

This includes:
- dashboard
- meetings
- recording
- upload
- transcript
- summary
- decisions
- tasks
- Arabic support
- connection health checks

### 2. There is a larger local layer that is present but not fully cleaned yet

This includes:
- workspaces
- workspace switching
- member management
- invites
- billing
- email templates
- cron reminders
- pricing

Relevant paths:
- `src/app/api/workspaces/*`
- `src/app/api/billing/*`
- `src/app/api/cron/task-reminders/route.ts`
- `src/app/invite/[token]/*`
- `src/app/pricing/page.tsx`
- `src/app/settings/workspace/*`
- `src/app/settings/billing/*`
- `src/components/workspace/workspace-switcher.tsx`
- `src/lib/workspace/*`
- `src/lib/billing/*`
- `src/lib/email/*`
- `src/lib/supabase/service.ts`
- `vercel.json`

Treat that layer as real code that builds, but still in handoff / finishing mode.

## Environment Variables

Base app:
- `SONIOX_API_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Additional SaaS layer:
- `NEXT_PUBLIC_APP_URL`
- `MOYASAR_SECRET_KEY`
- `MOYASAR_PUBLISHABLE_KEY`
- `MOYASAR_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

See `.env.local.example`.

## Current Known Gaps

These are the main gaps still worth finishing:

1. Some workspace/billing/invite copy still needs cleanup.
2. Some newer local files still contain mojibake or text-encoding damage.
3. README has lagged behind the larger local architecture.
4. No automated tests exist yet.
5. The workspace/billing layer needs a final product decision:
   either ship it fully as the official direction, or keep the app focused on the simpler company-meetings core for now.

## Recent Practical Bug Fixes

Recent fixes worth knowing before debugging the recording flow:

- Recording start no longer hangs forever without a cancel path.
- Soniox startup now fails faster instead of spinning for too long.
- Microphone test now distinguishes:
  - generic mic failure
  - permission denied
  - no microphone device found
- Arabic microphone labels were repaired after showing corrupted text.

If recording still fails for a user, first verify whether the issue is:
- browser microphone permission
- missing microphone device
- screen share permission
- Soniox temporary key generation
- Soniox websocket/session startup

## Recommended Next Steps

If a new developer continues from here, the best order is:

1. Decide whether the product is now officially workspace-first.
2. Clean the workspace/billing/invite layer if yes.
3. Update README and `.env.local.example` to fully match the final decision.
4. Add tests around:
   - meeting creation
   - recording session start/stop
   - summarize pipeline
   - task status updates
5. Remove any remaining corrupted copy in locale and settings files.

## Minimum Verification Before Shipping

```bash
npm run lint
npm run build
```

These checks were passing on the current working tree when this handoff note was written.
