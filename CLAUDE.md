# CLAUDE.md

This file gives the next coding agent a reliable snapshot of the current project state.

@AGENTS.md

## Project Direction

This repo is a company meetings execution platform, not a study or lecture product.

Core value:
- Capture a meeting.
- Process it automatically.
- Turn it into transcript, summary, decisions, and executable tasks.
- Help teams track what should happen after the meeting.

The homepage and dashboard are intentionally positioned around execution outcomes, not around recording as the main story.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

No automated test suite is configured yet.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase
- Soniox for live transcription
- OpenRouter for structured meeting analysis

## Current Product Flow

### Live meeting flow

1. Browser asks the server for a temporary Soniox key via `POST /api/soniox-temp-key`.
2. Browser opens the Soniox session directly from the client.
3. Browser records audio locally with `MediaRecorder`.
4. On stop, audio is uploaded to storage and the meeting is created.
5. The summarize route extracts structured outputs:
   - transcript
   - summary
   - key points
   - decisions
   - tasks
6. Dashboard and meeting detail pages surface the outputs.

### Uploaded recording flow

1. User uploads an existing recording.
2. File is stored.
3. Meeting processing runs through the same analysis pipeline.
4. Outputs appear in meetings, decisions, and tasks views.

## Key Modules

- `src/components/dashboard/company-dashboard.tsx`
  Main execution-focused homepage/dashboard.

- `src/components/recording/recording-session.tsx`
  Recording entry point and recording UI state.

- `src/components/recording/mic-test.tsx`
  Microphone readiness check and user-facing mic errors.

- `src/hooks/use-recording-modes.ts`
  Recording start/stop orchestration, start timeout handling, cancel-start logic.

- `src/lib/meeting-processing.ts`
  Meeting processing helpers used by API routes.

- `src/lib/meetings.ts`
  Meeting loading, task/decision shaping, and dashboard data helpers.

- `src/lib/i18n/context.tsx`
  Client language context with `en` and `ar`, including RTL support.

- `src/lib/supabase/*`
  Browser/server auth and Supabase helpers.

## API Surface In Active Use

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

## Current Database Shape

The local working tree contains three migrations:

- `supabase/migrations/001_company_meetings_baseline.sql`
- `supabase/migrations/002_workspaces.sql`
- `supabase/migrations/003_billing.sql`

The earlier student/lecture/tracks schema is no longer the product direction.

## Current Working Tree Status

There are two layers in the project right now:

### Stable shipped layer

Already pushed and intended to work as the current product:
- company-meetings positioning
- execution-first dashboard
- recording and upload flows
- transcript, summary, decisions, tasks
- settings connection health check
- Arabic localization fixes
- recording start timeout and clearer mic-error handling

### Larger local layer in progress

Present in the working tree and builds successfully, but should be treated as in-progress product expansion:
- workspaces
- workspace members
- invites
- billing
- email helpers
- cron reminders
- pricing page

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

## Environment Variables

Base product:
- `SONIOX_API_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Additional in-progress SaaS layer:
- `NEXT_PUBLIC_APP_URL`
- `MOYASAR_SECRET_KEY`
- `MOYASAR_PUBLISHABLE_KEY`
- `MOYASAR_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

See `.env.local.example`.

## Localization Notes

Translations live in:
- `public/locales/en.json`
- `public/locales/ar.json`

Recent fixes addressed corrupted Arabic strings in dashboard and microphone-status UI.

If Arabic text appears as question marks or mojibake again, check:
- file encoding
- copied strings in locale JSON
- whether the key exists in both locale files

## Known Follow-Up Areas

These are the main engineering follow-ups still worth doing:

1. Clean and finish the workspace/billing layer.
2. Update README and env documentation when that layer is officially adopted.
3. Add missing translation coverage for invite and billing/workspace copy.
4. Remove any remaining mojibake in non-shipped local UI files.
5. Add a real test strategy for critical flows.

## Verification Baseline

Before shipping changes, at minimum run:

```bash
npm run lint
npm run build
```

Both were passing on the current local working tree at the time this file was updated.
