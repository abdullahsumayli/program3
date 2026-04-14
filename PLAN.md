# خطة تطبيق اجتماعات - Meeting Transcription & Summarization App

## Context
المستخدم يحتاج تطبيق ويب لتسجيل الاجتماعات الأونلاين (يفتحه بجانب Zoom مثلاً)، يسجل الصوت من المايكروفون، يحوله لنص فوري أثناء التسجيل، ثم يلخصه تلقائياً بعد الانتهاء. التطبيق بدون تسجيل دخول، واجهة عربي/إنجليزي قابلة للتبديل.

---

## Tech Stack
| التقنية | الاستخدام |
|---------|----------|
| **Next.js 15** (App Router) | الفريمورك الأساسي |
| **Supabase** | قاعدة البيانات (PostgreSQL) |
| **Soniox v4** (`@soniox/client`) | تحويل الصوت لنص فوري عبر WebSocket |
| **Claude Sonnet 4.6 via OpenRouter** | تلخيص النص بعد الاجتماع (عبر OpenRouter API) |
| **Supabase Storage** | حفظ ملفات الصوت الأصلية |
| **Tailwind CSS** | التصميم (Light mode) |

---

## Database Schema (Supabase)

```sql
-- tracks: المسارات/الأشخاص
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- meetings: الاجتماعات
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    title TEXT,                              -- يُولَّد تلقائياً بواسطة AI من الملخص
    transcript TEXT NOT NULL DEFAULT '',     -- النص الكامل مع تمييز المتحدثين
    transcript_segments JSONB,               -- segments مع speaker_id + timestamps
    summary TEXT,                            -- الملخص (قابل للتعديل يدوياً)
    notes TEXT,                              -- ملاحظات المستخدم المخصصة
    duration INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT,                          -- رابط الملف الصوتي في Supabase Storage
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- tags: تصنيفات الاجتماعات
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- meeting_tags: علاقة many-to-many بين الاجتماعات والتاغات
CREATE TABLE meeting_tags (
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (meeting_id, tag_id)
);

-- Full-text search
ALTER TABLE meetings ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(transcript,'') || ' ' || coalesce(summary,''))
    ) STORED;
CREATE INDEX idx_meetings_fts ON meetings USING gin(fts);

-- settings: إعدادات التطبيق (صف واحد فقط)
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_prompt TEXT NOT NULL DEFAULT 'You are a meeting summarization assistant...',
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO settings (id) VALUES (1);
```

---

## File Structure

```
program3/
├── .env.local                    # API keys
├── next.config.ts
├── package.json
├── tailwind.config.ts
│
├── supabase/migrations/
│   └── 001_initial_schema.sql
│
├── public/locales/
│   ├── en.json                   # English UI strings
│   └── ar.json                   # Arabic UI strings
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (dir, lang, providers)
│   │   ├── page.tsx              # الصفحة الرئيسية - شبكة المسارات
│   │   ├── globals.css
│   │   ├── track/[id]/
│   │   │   ├── page.tsx          # صفحة المسار - قائمة الاجتماعات + بدء تسجيل
│   │   │   └── meeting/[meetingId]/
│   │   │       └── page.tsx      # تفاصيل الاجتماع (نص + ملخص)
│   │   └── api/
│   │       ├── soniox-temp-key/route.ts
│   │       ├── summarize/route.ts
│   │       ├── health/route.ts
│   │       ├── tracks/route.ts
│   │       ├── meetings/route.ts
│   │       ├── settings/route.ts
│   │       └── search/route.ts
│   │
│   ├── components/
│   │   ├── ui/                   # Button, Card, Dialog, Input, Tabs, SearchInput
│   │   ├── layout/
│   │   │   ├── header.tsx        # الهيدر + أيقونة الإعدادات
│   │   │   └── settings-modal.tsx
│   │   ├── tracks/
│   │   │   ├── track-grid.tsx
│   │   │   ├── track-card.tsx
│   │   │   └── add-track-dialog.tsx
│   │   ├── meetings/
│   │   │   ├── meeting-list.tsx
│   │   │   ├── meeting-item.tsx
│   │   │   └── meeting-detail.tsx
│   │   └── recording/
│   │       ├── recording-session.tsx   # المُنسق الرئيسي للتسجيل
│   │       ├── live-transcript.tsx     # النص الفوري أثناء التسجيل
│   │       ├── recording-controls.tsx  # أزرار التحكم + المؤقت
│   │       └── summarizing-state.tsx   # حالة التلخيص
│   │
│   ├── lib/
│   │   ├── supabase/client.ts, server.ts, types.ts
│   │   ├── soniox/client.ts      # Soniox browser wrapper
│   │   ├── openrouter/summarize.ts # Claude via OpenRouter API (server-only)
│   │   ├── i18n/context.tsx, translations.ts
│   │   └── utils.ts
│   │
│   └── hooks/
│       ├── use-recording.ts      # Hook للتسجيل (أهم ملف تقنياً)
│       └── use-settings.ts
```

---

## Implementation Phases

### Phase 1: Project Setup
1. `npx create-next-app@latest` with TypeScript + Tailwind + App Router
2. Install: `@supabase/supabase-js`, `@supabase/ssr`, `@soniox/client`, `openai` (OpenRouter compatible), `clsx`, `tailwind-merge`
3. Create `.env.local` with `SONIOX_API_KEY`, `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Run migration SQL on Supabase
5. Setup Supabase client/server helpers + TypeScript types

### Phase 2: Layout + i18n + UI Components
1. Root layout with `dir` attribute driven by language context
2. `LanguageProvider` context (localStorage + Supabase settings)
3. Translation files (en.json, ar.json)
4. Reusable UI components (Button, Card, Dialog, Input, Tabs, SearchInput)
5. Header component with settings gear icon + language toggle

### Phase 3: Home Page - Tracks
1. API route: GET/POST/DELETE tracks
2. TrackGrid, TrackCard, AddTrackDialog components
3. Home page server component

### Phase 4: Track Page - Meetings List
1. API route: GET/POST/DELETE meetings
2. MeetingList, MeetingItem components
3. Track page with "Start New Meeting" button

### Phase 5: Meeting Detail Page
1. MeetingDetail component with tabs (Transcript / Summary)
2. Meeting detail page

### Phase 6: Soniox Recording (Core Feature)
1. API route: `/api/soniox-temp-key` - issues temporary API key
2. `use-recording` hook: manages Soniox SDK, token accumulation, timer
3. RecordingSession, LiveTranscript, RecordingControls components
4. Flow: Start → record from mic → real-time tokens → Stop → save transcript

**Soniox Architecture:**
```
Browser → POST /api/soniox-temp-key → Server gets temp key from Soniox
Browser ← temp API key
Browser → WebSocket direct to Soniox (using @soniox/client SDK)
Browser ← streaming transcript tokens
```

### Phase 7: Claude Summarization (via OpenRouter)
1. `summarize.ts`: calls OpenRouter API (`https://openrouter.ai/api/v1/chat/completions`) with model `anthropic/claude-sonnet-4-6` and system prompt from settings
2. API route: `/api/summarize` - receives transcript, returns summary
3. SummarizingState loading component
4. Wire: Stop recording → save transcript → call summarize → save summary → redirect to detail

### Phase 8: Settings
1. API routes: GET/PUT settings, GET health check
2. Settings modal: connection indicators (green/red), system prompt textarea, language switcher

### Phase 9: Search + Polish
1. Search API using PostgreSQL full-text search
2. Search input on home page
3. Confirm delete dialogs
4. Loading states, error handling, empty states
5. RTL testing, responsive design

### Phase 10: Advanced Features (إضافات موسعة)

#### 10.1 - حفظ ملف الصوت الأصلي
- إعداد Supabase Storage bucket اسمه `meeting-audio`
- عند إيقاف التسجيل: رفع ملف الصوت (WebM/MP3) للـ Storage
- حفظ الرابط في `meetings.audio_url`
- في صفحة تفاصيل الاجتماع: عرض مشغل صوت `<audio>` لتشغيل التسجيل الأصلي

#### 10.2 - معالجة الاجتماعات الطويلة (Chunking)
- في `summarize.ts`: لو النص أكبر من 150K tokens → قسم على chunks
- لخص كل chunk لحاله → ثم لخص الملخصات مع بعض (hierarchical summarization)
- استخدم تقدير تقريبي: 1 token ≈ 4 أحرف إنجليزي / 2 حرف عربي

#### 10.3 - تمييز المتحدثين (Speaker Diarization)
- تفعيل `enable_speaker_diarization: true` في Soniox config
- كل token يرجع مع `speaker_id`
- في `LiveTranscript`: عرض النص بصيغة "المتحدث 1: ..." و "المتحدث 2: ..."
- حفظ الـ segments في `meetings.transcript_segments` (JSONB)
- السماح للمستخدم بإعادة تسمية المتحدثين (مثلاً: "علاء" بدل "متحدث 1")

#### 10.4 - تصدير الاجتماع (Export)
- زر "تصدير" في صفحة تفاصيل الاجتماع
- خيارات: PDF, Word (.docx), نص عادي (.txt), Markdown (.md)
- استخدام مكتبات: `jspdf` للـ PDF، `docx` للـ Word
- تنسيق التصدير: عنوان + تاريخ + ملخص + نص كامل

#### 10.5 - نسخ احتياطي (Backup / Export All)
- زر في صفحة الإعدادات: "تصدير كل البيانات"
- يصدر JSON فيه كل: tracks + meetings + tags + settings
- زر "استيراد": يقبل JSON ويستعيد البيانات

#### 10.6 - تعديل الملخص يدوياً
- في صفحة تفاصيل الاجتماع: زر "تعديل" بجانب الملخص
- يتحول لـ textarea قابل للتعديل → "حفظ"
- API: PATCH `/api/meetings/[id]` مع `{ summary }`

#### 10.7 - إعادة توليد الملخص
- زر "إعادة توليد" بجانب الملخص
- يستدعي `/api/summarize` من جديد بنفس الـ transcript
- مفيد لو المستخدم غير الـ system prompt وبغى ملخص بأسلوب جديد

#### 10.8 - ملاحظات مخصصة
- حقل `notes` في جدول `meetings`
- في صفحة تفاصيل الاجتماع: textarea للملاحظات (auto-save on blur)
- تظهر تحت الملخص أو في تبويب منفصل

#### 10.9 - تاغات/تصنيفات
- جداول `tags` + `meeting_tags` (موجودة في الـ schema أعلاه)
- API: GET/POST/DELETE `/api/tags`
- في صفحة تفاصيل الاجتماع: مكون "Tags" لإضافة/حذف التاغات
- في الصفحة الرئيسية: فلتر حسب التاغات
- كل تاغ له لون مخصص

#### 10.10 - توليد عنوان الاجتماع تلقائياً
- بعد التلخيص: استدعاء Claude مرة ثانية بـ prompt قصير لتوليد عنوان
- مثال: "Generate a short title (max 8 words) for this meeting based on the summary"
- حفظ العنوان في `meetings.title`
- المستخدم يقدر يعدله يدوياً

#### 10.11 - اختبار المايكروفون قبل التسجيل
- في صفحة بدء الاجتماع: زر "اختبر المايك"
- يسجل 3 ثواني → يعرض مستوى الصوت (volume meter) باستخدام Web Audio API
- مؤشر بصري أخضر/أحمر: "المايك يعمل" / "لا يوجد صوت"

#### 10.12 - تحذير قبل إغلاق الصفحة أثناء التسجيل
- استخدام `beforeunload` event listener في `use-recording` hook
- لما `isRecording === true` → يعرض رسالة تأكيد عند محاولة إغلاق التبويب
- كذلك حماية من التنقل داخل التطبيق أثناء التسجيل

---

## Key Technical Decisions

- **Soniox temp keys**: Real API key stays server-side. Browser gets short-lived temp keys via API route.
- **OpenRouter for Claude**: Use OpenRouter API (OpenAI-compatible) instead of Anthropic SDK directly. Model: `anthropic/claude-sonnet-4-6`.
- **Audio storage**: ملفات الصوت الأصلية تُحفظ في Supabase Storage (bucket: `meeting-audio`).
- **Speaker diarization**: مُفعَّل في Soniox، النتائج تُخزَّن في `transcript_segments` (JSONB).
- **Hierarchical summarization**: للاجتماعات الطويلة (>150K tokens) نقسم لـ chunks ونلخص على مرحلتين.
- **Auto-generated titles**: عناوين الاجتماعات تُولَّد تلقائياً من Claude بعد التلخيص.
- **Singleton settings**: One row in settings table (CHECK constraint), no auth needed.
- **Full-text search**: PostgreSQL `tsvector` with `simple` dictionary (works for Arabic + English).
- **Supabase RLS disabled**: Single-user app, no auth = permissive policies.
- **Recording protection**: `beforeunload` warning + in-app navigation guard أثناء التسجيل.

---

## Environment Variables

```env
SONIOX_API_KEY=xxx
OPENROUTER_API_KEY=xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

---

## Verification Plan
1. Create a track from the home page → verify it appears in the grid
2. Enter the track → اختبر المايك → verify volume meter يشتغل
3. Start a new meeting → verify mic permission prompt
4. Speak for ~30 seconds → verify live transcript appears in real-time مع تمييز المتحدثين
5. جرب إغلاق التبويب أثناء التسجيل → verify تحذير `beforeunload`
6. Stop recording → verify "summarizing..." state appears
7. Verify الملخص + العنوان المُولَّد تلقائياً + الملف الصوتي الأصلي كلها تظهر
8. عدل الملخص يدوياً → احفظ → verify التعديل محفوظ
9. اضغط "إعادة توليد الملخص" → verify يولد ملخص جديد
10. أضف ملاحظات مخصصة → verify auto-save
11. أضف تاغ للاجتماع → verify يظهر ويقدر تفلتر به
12. صدر الاجتماع كـ PDF/Word/Markdown → verify الملف صحيح
13. Test search from home page
14. Test delete track + meeting
15. Switch language to Arabic → verify RTL layout
16. Open settings → test connection check → modify system prompt
17. صدر كل البيانات كـ JSON → امسحها → استوردها → verify كل شي رجع
18. جرب اجتماع طويل (ساعة+) → verify التلخيص الهرمي يشتغل
