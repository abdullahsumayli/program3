# Program3

Program3 is a company meeting management platform built for internal teams. The product is focused on one flow only: capture a meeting, process it automatically, then turn it into clear decisions and executable tasks.

For the current engineering snapshot and handoff context, see [HANDOFF.md](./HANDOFF.md) and [CLAUDE.md](./CLAUDE.md).

## What It Does

- Record a live meeting inside the app.
- Upload an existing meeting recording.
- Generate a full transcript automatically.
- Produce a structured summary and key highlights.
- Extract `Decisions` from the meeting.
- Extract `Tasks` with a clear description, owner, due date, and status (`in_progress` or `completed`).
- Track all meetings, decisions, and task progress from one dashboard.
- Enforce a monthly usage limit of `120` minutes per workspace on the free plan before recording starts.

## Product Scope

This repo is dedicated to company meetings only.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Soniox for speech-to-text
- OpenRouter for structured meeting analysis

## Environment Variables

Create a local environment file and fill in the required keys:

```bash
cp .env.local.example .env.local
```

Required values:

- `SONIOX_API_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS` (comma-separated emails allowed to open `/admin`)

Additional values (workspace-first layer: workspaces, invites, billing, reminders):

- `NEXT_PUBLIC_APP_URL`
- `MOYASAR_SECRET_KEY`
- `MOYASAR_PUBLISHABLE_KEY`
- `MOYASAR_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create your local env file.

```bash
cp .env.local.example .env.local
```

3. Apply the Supabase migrations (in order):

- `supabase/migrations/001_company_meetings_baseline.sql`
- `supabase/migrations/002_workspaces.sql`
- `supabase/migrations/003_billing.sql`

4. Start the dev server.

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Useful Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Verification

The current refactor has been validated with:

```bash
npm run lint
npm run build
```

## Notes

- Recording is blocked when the user has no remaining monthly minutes.
- Meetings can be created either from live recording or uploaded audio.
- The dashboard is the central view for meetings, decisions, tasks, and usage.
- The working tree also contains a larger in-progress layer for workspaces, billing, invites, and reminders. Read `HANDOFF.md` before changing that area.
