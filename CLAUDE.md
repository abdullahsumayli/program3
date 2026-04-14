# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint (flat config, eslint.config.mjs)
```

No test framework is configured.

## Architecture

Meeting transcription and summarization web app. Next.js 16 App Router, Supabase (PostgreSQL), Soniox for real-time speech-to-text, Claude via OpenRouter for summarization. No authentication — single-user app with RLS disabled.

### Data flow: recording a meeting

1. Browser requests a temp Soniox API key via `POST /api/soniox-temp-key` (real key stays server-side)
2. Browser opens WebSocket directly to Soniox using `@soniox/speech-to-text-web` SDK with the temp key
3. Streaming tokens arrive in the browser; `useRecording` hook accumulates final/non-final tokens with speaker diarization
4. Simultaneously, `MediaRecorder` captures raw audio as WebM
5. On stop: audio uploaded to Supabase Storage via `POST /api/upload-audio`, meeting row created via `POST /api/meetings`, then `POST /api/summarize` calls OpenRouter (Claude) for summary + auto-generated title
6. User redirected to meeting detail page

### Key modules

- **`src/hooks/use-recording.ts`** — Core recording orchestrator. Manages Soniox WebSocket, MediaRecorder, timer, token accumulation, speaker segment building, and `beforeunload` protection.
- **`src/lib/openrouter/summarize.ts`** — Server-only. Calls OpenRouter API (OpenAI SDK with custom baseURL). Handles hierarchical chunked summarization for long transcripts (>500K chars). Also generates meeting titles.
- **`src/lib/i18n/context.tsx`** — Client-side `LanguageProvider` context. Supports `en`/`ar` with RTL. Locale stored in localStorage and synced to the `settings` table. Use `useLanguage()` hook and `t()` for translations.
- **`src/lib/supabase/client.ts`** vs **`server.ts`** — Browser uses `createBrowserClient`, server components/routes use `createServerClient` with cookie handling.

### Translations

UI strings live in `public/locales/en.json` and `public/locales/ar.json`. Access via `const { t } = useLanguage()` then `t("key.path")`.

### Database

Schema in `supabase/migrations/001_initial_schema.sql`. Tables: `tracks`, `meetings`, `tags`, `meeting_tags`, `settings` (singleton row, id=1). Full-text search via generated `tsvector` column on meetings using `simple` dictionary (works for Arabic + English).

### API routes

All under `src/app/api/`. CRUD routes for tracks, meetings (including `[id]` dynamic route), settings, tags. Special routes: `soniox-temp-key`, `summarize`, `health`, `search`, `backup`, `export/[id]`, `upload-audio`.

### Styling

Tailwind CSS v4 via `@tailwindcss/postcss`. Light mode only. RTL handled by `html[dir="rtl"]` set dynamically by `LanguageProvider`. Fonts: Inter (Latin) + Noto Sans Arabic, priority swaps based on direction. Custom UI components in `src/components/ui/`.

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## Environment variables

Required in `.env.local` (see `.env.local.example`):
- `SONIOX_API_KEY` — server-only, used to issue temp keys
- `OPENROUTER_API_KEY` — server-only, for Claude summarization
- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, for storage operations
